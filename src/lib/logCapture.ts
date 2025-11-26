import { EventEmitter } from 'events';

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

class LogCapture extends EventEmitter {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  addLog(logData: Omit<LogEntry, 'id' | 'timestamp'>) {
    const log: LogEntry = {
      ...logData,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    this.logs.push(log);

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.emit('log', log);
    console.log('Log stored. Total logs:', this.logs.length);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    console.log('Clearing all logs');
    this.logs = [];
    this.emit('cleared');
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
