// src/lib/cvLogWatcher.ts
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';

export interface CVLogEntry {
  id: string;
  source: 'app' | 'pixtral' | 'lmdeploy_exec' | 'lmdeploy_serve';
  message: string;
  timestamp: string;
  type: 'info' | 'error' | 'warning' | 'success';
  rawLines?: string[];
}

interface WatcherInstance {
  watcher: chokidar.FSWatcher;
  position: number;
  inode: number;
  buffer: string;
  pendingLog: CVLogEntry | null;
  lastEmitTime: number;
}

class CVLogWatcher extends EventEmitter {
  private watchers: Map<string, Map<string, WatcherInstance>> = new Map();
  private recentLogs: Map<string, CVLogEntry[]> = new Map();
  private maxRecentLogs = 500;
  private flushInterval: NodeJS.Timeout | null = null;

  private logStartPatterns = {
    app: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} \| (INFO|ERROR|WARNING|DEBUG)/,
    pixtral: /^(INFO:|ERROR:|WARNING:|Starting |new request |gone request |ending )/,
    lmdeploy_exec: /^(✓|=|Available GPUs|Using |Searching |Launched |HINT:)/,
    lmdeploy_serve: /^(\/usr\/local|FlashAttention|InternLM2|Warning:|^\[TM\]|^HINT:|^INFO:|\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/,
  };

  private timestampPatterns = {
    app: /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d{3}/,
    pixtral: /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6})/,
    lmdeploy_exec: null,
    lmdeploy_serve: /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d{3}/,
  };

  constructor() {
    super();
    this.startAutoFlush();
  }

  private startAutoFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flushInterval = setInterval(() => {
      this.flushAllPendingLogs();
    }, 2000);
  }

  private flushAllPendingLogs(): void {
    const now = Date.now();
    
    this.watchers.forEach((baseWatchers, basePath) => {
      baseWatchers.forEach((watcherInstance, source) => {
        if (watcherInstance.pendingLog && (now - watcherInstance.lastEmitTime) > 1500) {
          console.log(`Auto-flushing pending log from ${source}`);
          this.emitLog(basePath, watcherInstance.pendingLog);
          watcherInstance.pendingLog = null;
        }
      });
    });
  }

  async startWatching(basePath: string, sources: string[]): Promise<void> {
    if (!this.watchers.has(basePath)) {
      this.watchers.set(basePath, new Map());
      this.recentLogs.set(basePath, []);
    }

    for (const source of sources) {
      await this.startWatchingFile(basePath, source);
    }
  }

  async startWatchingFile(basePath: string, source: string): Promise<void> {
    const filePath = path.join(basePath, `${source}.log`);

    if (!fs.existsSync(filePath)) {
      console.warn(`Log file not found: ${filePath}`);
      return;
    }

    const baseWatchers = this.watchers.get(basePath);
    if (!baseWatchers) return;

    if (baseWatchers.has(source)) {
      const existing = baseWatchers.get(source);
      if (existing?.pendingLog) {
        this.emitLog(basePath, existing.pendingLog);
      }
      existing?.watcher.close();
    }

    const stats = fs.statSync(filePath);
    const watcher = chokidar.watch(filePath, {
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    const watcherInstance: WatcherInstance = {
      watcher,
      position: stats.size,
      inode: stats.ino,
      buffer: '',
      pendingLog: null,
      lastEmitTime: Date.now(),
    };

    baseWatchers.set(source, watcherInstance);

    watcher.on('change', async (changedPath) => {
      await this.handleFileChange(basePath, source, changedPath);
    });

    console.log(`Started watching: ${filePath}`);
  }

  private async handleFileChange(
    basePath: string,
    source: string,
    filePath: string
  ): Promise<void> {
    const baseWatchers = this.watchers.get(basePath);
    if (!baseWatchers) return;

    const watcherInstance = baseWatchers.get(source);
    if (!watcherInstance) return;

    try {
      const stats = fs.statSync(filePath);

      if (stats.ino !== watcherInstance.inode) {
        console.log(`Log rotation detected for ${source}`);
        if (watcherInstance.pendingLog) {
          this.emitLog(basePath, watcherInstance.pendingLog);
        }
        watcherInstance.position = 0;
        watcherInstance.inode = stats.ino;
        watcherInstance.buffer = '';
        watcherInstance.pendingLog = null;
      }

      if (stats.size < watcherInstance.position) {
        console.log(`Log truncation detected for ${source}`);
        if (watcherInstance.pendingLog) {
          this.emitLog(basePath, watcherInstance.pendingLog);
        }
        watcherInstance.position = 0;
        watcherInstance.buffer = '';
        watcherInstance.pendingLog = null;
      }

      if (stats.size > watcherInstance.position) {
        const stream = fs.createReadStream(filePath, {
          start: watcherInstance.position,
          end: stats.size,
        });

        let newData = '';
        for await (const chunk of stream) {
          newData += chunk.toString('utf-8');
        }

        watcherInstance.position = stats.size;
        watcherInstance.buffer += newData;

        this.processBuffer(basePath, source, watcherInstance);
      }
    } catch (error) {
      console.error(`Error handling file change for ${source}:`, error);
    }
  }

  private processBuffer(
    basePath: string,
    source: string,
    watcherInstance: WatcherInstance
  ): void {
    const lines = watcherInstance.buffer.split('\n');
    watcherInstance.buffer = lines.pop() || '';

    const sourceType = source as keyof typeof this.logStartPatterns;
    const startPattern = this.logStartPatterns[sourceType];

    for (const line of lines) {
      if (!line.trim()) continue;

      const isNewLog = startPattern ? startPattern.test(line) : false;

      if (isNewLog) {
        if (watcherInstance.pendingLog) {
          this.emitLog(basePath, watcherInstance.pendingLog);
          watcherInstance.pendingLog = null;
        }

        const timestamp = this.extractTimestamp(line, sourceType) || new Date().toISOString();
        const type = this.determineLogType(line);

        watcherInstance.pendingLog = {
          id: `${source}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          source: source as any,
          message: line,
          timestamp,
          type,
          rawLines: [line],
        };
        watcherInstance.lastEmitTime = Date.now();
      } else {
        if (watcherInstance.pendingLog) {
          watcherInstance.pendingLog.message += '\n' + line;
          watcherInstance.pendingLog.rawLines?.push(line);
          watcherInstance.lastEmitTime = Date.now();
        } else {
          const timestamp = this.extractTimestamp(line, sourceType) || new Date().toISOString();
          const type = this.determineLogType(line);

          const singleLineLog: CVLogEntry = {
            id: `${source}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            source: source as any,
            message: line,
            timestamp,
            type,
            rawLines: [line],
          };
          
          this.emitLog(basePath, singleLineLog);
        }
      }
    }
  }

  private extractTimestamp(line: string, source: keyof typeof this.timestampPatterns): string | null {
    const pattern = this.timestampPatterns[source];
    if (!pattern) return null;

    const match = line.match(pattern);
    if (match) {
      try {
        return new Date(match[1]).toISOString();
      } catch {
        return null;
      }
    }
    return null;
  }

  private determineLogType(line: string): CVLogEntry['type'] {
    const lowerLine = line.toLowerCase();
    
    if (
      lowerLine.includes('error') ||
      lowerLine.includes('exception') ||
      lowerLine.includes('failed') ||
      lowerLine.includes('fatal') ||
      lowerLine.includes('critical') ||
      lowerLine.includes('traceback')
    ) {
      return 'error';
    }

    if (
      lowerLine.includes('warning') ||
      lowerLine.includes('warn') ||
      lowerLine.includes('deprecated')
    ) {
      return 'warning';
    }

    if (
      lowerLine.includes('success') ||
      lowerLine.includes('completed') ||
      lowerLine.includes('done') ||
      lowerLine.includes('✓') ||
      lowerLine.includes('✅')
    ) {
      return 'success';
    }

    return 'info';
  }

  private emitLog(basePath: string, log: CVLogEntry): void {
    console.log(`Emitting log from ${log.source}: ${log.message.substring(0, 50)}...`);
    
    const recentLogs = this.recentLogs.get(basePath) || [];
    recentLogs.push(log);
    
    if (recentLogs.length > this.maxRecentLogs) {
      recentLogs.shift();
    }
    
    this.recentLogs.set(basePath, recentLogs);
    this.emit('log', log);
  }

  async getHistoricalLogs(
    basePath: string,
    sources: string[],
    lines: number = 100
  ): Promise<CVLogEntry[]> {
    const allLogs: CVLogEntry[] = [];

    for (const source of sources) {
      const filePath = path.join(basePath, `${source}.log`);

      if (!fs.existsSync(filePath)) {
        console.warn(`Log file not found: ${filePath}`);
        continue;
      }

      try {
        const content = await this.readLastLines(filePath, lines * 50);
        const logLines = content.split('\n').filter(line => line.trim());

        const sourceType = source as keyof typeof this.logStartPatterns;
        const startPattern = this.logStartPatterns[sourceType];

        let currentLog: CVLogEntry | null = null;
        const sourceLogs: CVLogEntry[] = [];

        for (const line of logLines) {
          const isNewLog = startPattern ? startPattern.test(line) : false;

          if (isNewLog) {
            if (currentLog) {
              sourceLogs.push(currentLog);
            }

            const timestamp = this.extractTimestamp(line, sourceType) || new Date().toISOString();
            const type = this.determineLogType(line);

            currentLog = {
              id: `${source}-hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              source: source as any,
              message: line,
              timestamp,
              type,
              rawLines: [line],
            };
          } else {
            if (currentLog) {
              currentLog.message += '\n' + line;
              currentLog.rawLines?.push(line);
            } else {
              const timestamp = this.extractTimestamp(line, sourceType) || new Date().toISOString();
              const type = this.determineLogType(line);

              sourceLogs.push({
                id: `${source}-hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                source: source as any,
                message: line,
                timestamp,
                type,
                rawLines: [line],
              });
            }
          }
        }

        if (currentLog) {
          sourceLogs.push(currentLog);
        }

        console.log(`Loaded ${sourceLogs.length} historical logs from ${source}`);
        
        allLogs.push(...sourceLogs);

      } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
      }
    }

    allLogs.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    console.log(`Total historical logs: ${allLogs.length} from sources: ${sources.join(', ')}`);
    
    const logsBySource = sources.map(s => ({
      source: s,
      count: allLogs.filter(l => l.source === s).length
    }));
    console.log('Logs by source:', logsBySource);

    return allLogs.slice(-lines);
  }

  private async readLastLines(filePath: string, estimatedLines: number): Promise<string> {
    const stats = fs.statSync(filePath);
    const estimatedBytes = estimatedLines * 150;
    const bufferSize = Math.min(estimatedBytes, stats.size);
    const buffer = Buffer.alloc(bufferSize);

    const fd = fs.openSync(filePath, 'r');
    const startPosition = Math.max(0, stats.size - bufferSize);
    const bytesRead = fs.readSync(fd, buffer, 0, bufferSize, startPosition);
    fs.closeSync(fd);

    return buffer.slice(0, bytesRead).toString('utf-8');
  }

  getRecentLogs(basePath: string): CVLogEntry[] {
    return this.recentLogs.get(basePath) || [];
  }

  stopWatchingFile(basePath: string, source: string): void {
    const baseWatchers = this.watchers.get(basePath);
    if (baseWatchers?.has(source)) {
      const watcherInstance = baseWatchers.get(source);
      
      if (watcherInstance?.pendingLog) {
        this.emitLog(basePath, watcherInstance.pendingLog);
      }
      
      watcherInstance?.watcher.close();
      baseWatchers.delete(source);
      console.log(`Stopped watching: ${source}`);
    }
  }

  stopWatchingAll(basePath: string): void {
    const baseWatchers = this.watchers.get(basePath);
    if (baseWatchers) {
      baseWatchers.forEach((instance, source) => {
        if (instance.pendingLog) {
          this.emitLog(basePath, instance.pendingLog);
        }
        instance.watcher.close();
        console.log(`Stopped watching: ${source}`);
      });
      this.watchers.delete(basePath);
      this.recentLogs.delete(basePath);
    }
  }

  cleanup(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  getAvailableSources(): string[] {
    return ['app', 'pixtral', 'lmdeploy_exec', 'lmdeploy_serve'];
  }
}

const globalForCVLogWatcher = globalThis as unknown as {
  cvLogWatcher: CVLogWatcher | undefined;
};

export const getCVLogWatcher = (): CVLogWatcher => {
  if (!globalForCVLogWatcher.cvLogWatcher) {
    globalForCVLogWatcher.cvLogWatcher = new CVLogWatcher();
  }
  return globalForCVLogWatcher.cvLogWatcher;
};

export default getCVLogWatcher;