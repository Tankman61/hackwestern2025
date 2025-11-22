// WebSocket connection manager for Alpaca real-time data streaming

export type AlpacaDataType = 'crypto' | 'stocks' | 'options' | 'etfs';

export interface AlpacaBar {
  symbol: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AlpacaTrade {
  symbol: string;
  timestamp: number;
  price: number;
  size: number;
}

export interface AlpacaQuote {
  symbol: string;
  timestamp: number;
  bid_price: number;
  ask_price: number;
  bid_size: number;
  ask_size: number;
}

export type AlpacaMessage = 
  | { type: 'bar'; data: AlpacaBar }
  | { type: 'trade'; data: AlpacaTrade }
  | { type: 'quote'; data: AlpacaQuote }
  | { type: 'error'; message: string }
  | { type: 'connected'; message: string }
  | { type: 'subscribed'; symbols: string[] };

type MessageHandler = (message: AlpacaMessage) => void;

class AlpacaWebSocketManager {
  private ws: WebSocket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private baseUrl: string;
  private subscribedSymbols: Set<string> = new Set();
  private dataType: AlpacaDataType;

  constructor(baseUrl: string = 'ws://localhost:8000', dataType: AlpacaDataType = 'stocks') {
    this.baseUrl = baseUrl;
    this.dataType = dataType;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      // Connect to FastAPI WebSocket endpoint
      this.ws = new WebSocket(`${this.baseUrl}/ws/alpaca/${this.dataType}`);

      this.ws.onopen = () => {
        console.log(`✅ WebSocket connected to ${this.dataType} stream`);
        this.reconnectAttempts = 0;
        
        // Resubscribe to symbols if reconnecting
        if (this.subscribedSymbols.size > 0) {
          console.log(`🔄 Resubscribing to symbols:`, Array.from(this.subscribedSymbols));
          // Small delay to ensure connection is fully ready
          setTimeout(() => {
            this.subscribe(Array.from(this.subscribedSymbols));
          }, 100);
        }

        this.notifyHandlers({
          type: 'connected',
          message: `Connected to ${this.dataType} stream`
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const message: AlpacaMessage = JSON.parse(event.data);
          this.notifyHandlers(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          console.error('Raw data that failed to parse:', event.data);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.notifyHandlers({
          type: 'error',
          message: 'WebSocket connection error'
        });
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.ws = null;
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
      this.notifyHandlers({
        type: 'error',
        message: 'Failed to reconnect to Alpaca stream'
      });
    }
  }

  subscribe(symbols: string[]) {
    symbols.forEach(symbol => this.subscribedSymbols.add(symbol));
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn(`⏳ WebSocket not connected. Symbols [${symbols.join(', ')}] will be subscribed upon connection.`);
      return;
    }

    console.log(`📡 Subscribing to symbols:`, symbols);
    this.ws.send(JSON.stringify({
      action: 'subscribe',
      symbols: symbols
    }));
  }

  unsubscribe(symbols: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected');
      return;
    }

    symbols.forEach(symbol => this.subscribedSymbols.delete(symbol));

    this.ws.send(JSON.stringify({
      action: 'unsubscribe',
      symbols: symbols
    }));
  }

  addHandler(handler: MessageHandler) {
    this.handlers.add(handler);
  }

  removeHandler(handler: MessageHandler) {
    this.handlers.delete(handler);
  }

  private notifyHandlers(message: AlpacaMessage) {
    this.handlers.forEach(handler => handler(message));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.handlers.clear();
    this.subscribedSymbols.clear();
    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }
}

// Create singleton instances for each data type
export const cryptoWebSocket = new AlpacaWebSocketManager('ws://localhost:8000', 'crypto');
export const stocksWebSocket = new AlpacaWebSocketManager('ws://localhost:8000', 'stocks');
export const optionsWebSocket = new AlpacaWebSocketManager('ws://localhost:8000', 'options');
export const etfsWebSocket = new AlpacaWebSocketManager('ws://localhost:8000', 'etfs');

export default AlpacaWebSocketManager;
