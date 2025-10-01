export type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';
export type ConsoleMode = 'console' | 'network' | 'broadcast' | 'database' | 'dev';
export type DetailView = 'requestHeaders' | 'responseHeaders' | 'requestBody' | 'responseBody';

export interface LogEntry {
  id: number;
  level: LogLevel;
  timestamp: string;
  args: any[];
}

export interface NetworkLogEntry {
  id: number;
  url: string;
  method: string;
  status: number | null;
  ok: boolean | null;
  timestamp: string;
  requestHeaders: Record<string, string>;
  requestBody: any;
  responseHeaders: Record<string, string>;
  responseBody: any;
}

export interface SignedBroadcastLogEntry {
  id: number;
  timestamp: string;
  data: any; // The raw event.data
}