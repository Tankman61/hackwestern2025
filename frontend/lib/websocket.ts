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

export interface AlpacaOrderUpdate {
  id: string;
  ticker: string;
  order_type: string;
  amount: number;
  limit_price?: number;
  status: string;
  created_at?: string;
  side: string;
}

export type AlpacaMessage = 
  | { type: 'bar'; data: AlpacaBar }
  | { type: 'trade'; data: AlpacaTrade }
  | { type: 'quote'; data: AlpacaQuote }
  | { type: 'order_update'; data: AlpacaOrderUpdate }
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
  private isConnecting: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(baseUrl: string = 'ws://localhost:8000', dataType: AlpacaDataType = 'stocks') {
    this.baseUrl = baseUrl;
    this.dataType = dataType;
  }

  async connect() {
    // If already connected, return immediately
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    // If already connecting, wait for that connection attempt
    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    // If in CONNECTING state, wait a bit and check again
    if (this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Set connecting flag and create promise
    this.isConnecting = true;
    this.connectionPromise = this._doConnect();
    
    try {
      await this.connectionPromise;
    } finally {
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }

  private async _doConnect() {
    // Clean up any existing connection before creating a new one
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // Ignore errors when closing
      }
      this.ws = null;
    }

    // Check if backend is reachable first
    try {
      const httpUrl = this.baseUrl.replace('ws://', 'http://').replace('wss://', 'https://');
      const healthCheck = await fetch(`${httpUrl}/health`);
      if (!healthCheck.ok) {
        console.error(`❌ Backend health check failed: ${healthCheck.status} ${healthCheck.statusText}`);
        this.notifyHandlers({
          type: 'error',
          message: `Backend server returned error: ${healthCheck.status}. Make sure the backend is running on ${httpUrl}`
        });
        this.isConnecting = false;
        this.connectionPromise = null;
        return;
      }
    } catch (error) {
      console.error(`❌ Cannot reach backend server at ${this.baseUrl.replace('ws://', 'http://')}`);
      console.error('   Make sure the backend server is running: uvicorn app.main:app --reload');
      this.notifyHandlers({
        type: 'error',
        message: `Cannot connect to backend server. Make sure it's running on ${this.baseUrl.replace('ws://', 'http://')}`
      });
      this.isConnecting = false;
      this.connectionPromise = null;
      this.attemptReconnect();
      return;
    }

    try {
      const wsUrl = `${this.baseUrl}/ws/alpaca/${this.dataType}`;
      
      // Connect to FastAPI WebSocket endpoint
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.connectionPromise = null;
        
        // Resubscribe to symbols if reconnecting
        if (this.subscribedSymbols.size > 0) {
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
          // Only log parsing errors if it's actually a JSON parse error
          // Chart update errors will be handled by the component
          if (error instanceof SyntaxError) {
            console.error('Failed to parse WebSocket message:', error);
            console.error('Raw data that failed to parse:', event.data);
          }
          // Silently ignore other errors (like chart update errors that propagate)
        }
      };

      this.ws.onerror = (event: Event) => {
        // WebSocket error events don't provide much detail, but we can check the readyState
        const readyState = this.ws?.readyState;
        
        // Only log errors if we're not already closed/closing (which is expected during cleanup)
        if (readyState !== WebSocket.CLOSED && readyState !== WebSocket.CLOSING) {
          const readyStateText = 
            readyState === WebSocket.CONNECTING ? 'CONNECTING' :
            readyState === WebSocket.OPEN ? 'OPEN' :
            readyState === WebSocket.CLOSING ? 'CLOSING' :
            readyState === WebSocket.CLOSED ? 'CLOSED' : 'UNKNOWN';
          
          console.warn(`⚠️ WebSocket connection error (${readyStateText}). Will retry...`);
          
          // Only notify handlers if this is an unexpected error
          if (readyState === WebSocket.CONNECTING) {
            // Connection failed - will be handled by onclose
            return;
          }
        }
      };

      this.ws.onclose = (event: CloseEvent) => {
        const wasClean = event.wasClean;
        const code = event.code;
        
        this.ws = null;
        this.isConnecting = false;
        this.connectionPromise = null;
        
        // Only attempt reconnect if it wasn't a clean close (code 1000)
        // or if it was an unexpected close
        if (code !== 1000) {
          this.attemptReconnect();
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
      console.error('   Please check:');
      console.error('   1. Is the backend server running? (uvicorn app.main:app --reload)');
      console.error(`   2. Is it accessible at ${this.baseUrl.replace('ws://', 'http://')}?`);
      console.error('   3. Check backend logs for errors');
      this.notifyHandlers({
        type: 'error',
        message: `Failed to reconnect after ${this.maxReconnectAttempts} attempts. Check backend server.`
      });
    }
  }

  subscribe(symbols: string[]) {
    symbols.forEach(symbol => this.subscribedSymbols.add(symbol));
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Silently queue symbols for subscription when connection is established
      // The connection handler will automatically resubscribe
      return;
    }

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
    this.isConnecting = false;
    this.connectionPromise = null;
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
