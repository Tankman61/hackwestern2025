import { useEffect, useRef, useCallback } from 'react';
import type { AlpacaMessage, AlpacaDataType } from '@/lib/websocket';
import { cryptoWebSocket, stocksWebSocket, optionsWebSocket, etfsWebSocket } from '@/lib/websocket';

interface UseAlpacaWebSocketOptions {
  symbols: string[];
  dataType: AlpacaDataType;
  onMessage?: (message: AlpacaMessage) => void;
  autoConnect?: boolean;
}

export function useAlpacaWebSocket({
  symbols,
  dataType,
  onMessage,
  autoConnect = true
}: UseAlpacaWebSocketOptions) {
  const wsRef = useRef<any>(null);

  // Select the appropriate WebSocket instance based on dataType
  useEffect(() => {
    switch (dataType) {
      case 'crypto':
        wsRef.current = cryptoWebSocket;
        break;
      case 'stocks':
        wsRef.current = stocksWebSocket;
        break;
      case 'options':
        wsRef.current = optionsWebSocket;
        break;
      case 'etfs':
        wsRef.current = etfsWebSocket;
        break;
    }
  }, [dataType]);

  // Handle messages
  useEffect(() => {
    if (!onMessage || !wsRef.current) return;

    const handler = (message: AlpacaMessage) => {
      onMessage(message);
    };

    wsRef.current.addHandler(handler);

    return () => {
      wsRef.current?.removeHandler(handler);
    };
  }, [onMessage]);

  // Connect and subscribe to symbols
  useEffect(() => {
    if (!wsRef.current || !autoConnect) return;

    console.log(`🔌 Connecting to ${wsRef.current.dataType} stream for symbols:`, symbols);
    wsRef.current.connect();

    if (symbols.length > 0) {
      // Subscribe immediately (the WebSocket manager will handle queuing if not connected)
      wsRef.current.subscribe(symbols);
      
      const timer = setTimeout(() => {
        // Retry subscription after connection is established
        if (wsRef.current?.isConnected()) {
          console.log(`🔄 Retrying subscription to:`, symbols);
          wsRef.current.subscribe(symbols);
        }
      }, 500);

      return () => {
        clearTimeout(timer);
        // Unsubscribe when symbols change or component unmounts
        if (wsRef.current && symbols.length > 0) {
          wsRef.current.unsubscribe(symbols);
        }
      };
    }
  }, [symbols, autoConnect]);

  // Subscribe to new symbols
  const subscribe = useCallback((newSymbols: string[]) => {
    wsRef.current?.subscribe(newSymbols);
  }, []);

  // Unsubscribe from symbols
  const unsubscribe = useCallback((symbolsToRemove: string[]) => {
    wsRef.current?.unsubscribe(symbolsToRemove);
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    wsRef.current?.disconnect();
  }, []);

  // Check connection status
  const isConnected = useCallback(() => {
    return wsRef.current?.isConnected() ?? false;
  }, []);

  return {
    subscribe,
    unsubscribe,
    disconnect,
    isConnected
  };
}
