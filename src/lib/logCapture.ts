// src/lib/logCapture.ts

export interface LogEntry {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  endpoint: string;
  method: string;
  statusCode: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

class SimpleEventEmitter {
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  off(event: string, listener: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

class LogCapture extends SimpleEventEmitter {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  addLog(logData: Omit<LogEntry, 'id' | 'timestamp'>): void {
    const log: LogEntry = {
      ...logData,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    this.logs.push(log);

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Emit the log event
    this.emit('log', log);
    console.log('Log stored. Total logs:', this.logs.length);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    console.log('Clearing all logs');
    this.logs = [];
    this.emit('cleared');
  }

  getLogCount(): number {
    return this.logs.length;
  }

  getLogsByType(type: LogEntry['type']): LogEntry[] {
    return this.logs.filter(log => log.type === type);
  }

  getLogsByEndpoint(endpoint: string): LogEntry[] {
    return this.logs.filter(log => log.endpoint === endpoint);
  }
}

const globalForLogCapture = globalThis as unknown as {
  logCaptureInstance: LogCapture | undefined;
};

export function getLogCapture(): LogCapture {
  if (!globalForLogCapture.logCaptureInstance) {
    globalForLogCapture.logCaptureInstance = new LogCapture();
    console.log('LogCapture instance created');
  }
  return globalForLogCapture.logCaptureInstance;
}

export function resetLogCapture(): void {
  if (globalForLogCapture.logCaptureInstance) {
    globalForLogCapture.logCaptureInstance.clearLogs();
    globalForLogCapture.logCaptureInstance.removeAllListeners();
  }
  globalForLogCapture.logCaptureInstance = undefined;
}