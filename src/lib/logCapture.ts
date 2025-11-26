// lib/logCapture.ts
import { EventEmitter } from 'events';

interface LogEntry {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  endpoint: string;
  method: string;
  statusCode: number;
  timestamp: string;
  metadata?: Record<string, unknown>; // stricter type
}

class LogCapture extends EventEmitter {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  constructor() {
    super();
  }

  public addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>) {
    const logEntry: LogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
    };

    this.logs.push(logEntry);
    
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.emit('log', logEntry);
  }

  public getLogs(): LogEntry[] {
    return this.logs;
  }

  public clearLogs(): void {
    this.logs = [];
  }
}

let logCaptureInstance: LogCapture | null = null;

export function getLogCapture(): LogCapture {
  if (!logCaptureInstance) {
    logCaptureInstance = new LogCapture();
  }
  return logCaptureInstance;
}

export type { LogEntry };
