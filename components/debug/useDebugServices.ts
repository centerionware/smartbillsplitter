import { useState, useEffect } from 'react';
import type { LogEntry, NetworkLogEntry, SignedBroadcastLogEntry, LogLevel } from './types';

export const useDebugServices = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [networkLogs, setNetworkLogs] = useState<NetworkLogEntry[]>([]);
    const [broadcastLogs, setBroadcastLogs] = useState<SignedBroadcastLogEntry[]>([]);
    const [networkInterceptionActive, setNetworkInter