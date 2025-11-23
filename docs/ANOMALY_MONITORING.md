# Anomaly Monitoring System

A service that constantly monitors Finnhub and other services for significant anomalies and pings the AI agent when detected.

## Overview

The anomaly monitoring system consists of:

1. **AnomalyMonitor Service** (`app/services/anomaly_monitor.py`)
   - Detects anomalies using statistical methods (Z-score, rate of change)
   - Tracks historical values for baseline calculation
   - Identifies outliers, sudden changes, and trend breaks

2. **AnomalyWorker** (`app/workers/anomaly_worker.py`)
   - Runs every 5 seconds
   - Monitors Finnhub prices, portfolio balance, market context, and trading activity
   - When anomalies are detected, pings the AI agent via WebSocket

## What Gets Monitored

### Finnhub Service (Primary)
- **Price anomalies**: Sudden price movements (>5% change)
- **Statistical outliers**: Prices that are 2.5+ standard deviations from baseline
- **Trend breaks**: Sudden reversals in price direction

### Portfolio Balance
- Significant balance changes (>5%)
- Unusual account activity

### Market Context
- BTC price movements (>3% change)
- Risk score spikes (>20% increase)
- Extreme 24h price changes (>5%)

## How It Works

1. **Baseline Building**: The system tracks the last 10 values for each metric to establish a baseline
2. **Anomaly Detection**: Uses multiple methods:
   - **Z-score analysis**: Detects statistical outliers (2.5+ standard deviations)
   - **Rate of change**: Detects sudden movements (configurable threshold)
   - **Trend breaks**: Detects sudden reversals in direction
3. **Alert Generation**: When anomalies are detected:
   - Generates alert message with details
   - Sends `ANOMALY_ALERT` WebSocket message
   - Logs warning messages

## Usage

### Running the Worker

```python
from app.workers.anomaly_worker import run_anomaly_worker

# Start the anomaly worker
asyncio.run(run_anomaly_worker(
    websocket_manager=your_ws_manager,  # Optional
    agent_session_manager=your_agent_manager  # Optional
))
```

### Testing

Run the test script:

```bash
python test_anomaly_worker.py
```

This will:
1. Test anomaly detection logic with simulated data
2. Run a single worker cycle with real data
3. Test agent ping functionality

### Manual Testing

```python
from app.services.anomaly_monitor import AnomalyMonitor

monitor = AnomalyMonitor()

# Add baseline values
monitor.add_metric_value("btc_price", 96500.00)
monitor.add_metric_value("btc_price", 96550.00)
# ... add more baseline values

# Detect anomaly
anomaly = monitor.detect_anomalies("btc_price", 100500.00)  # 4% spike
if anomaly:
    print(f"Anomaly detected: {anomaly['message']}")
```

## Configuration

### Anomaly Detection Thresholds

- **Z-score threshold**: Default 2.5 (can be set in constructor)
- **Rate of change threshold**: Configurable per metric (default 5% for prices)
- **Window size**: Default 10 historical values

### Worker Settings

- **Check interval**: 5 seconds (configurable in `AnomalyWorker.interval_seconds`)
- **Anomaly cooldown**: 60 seconds (prevents spam)
- **Severity levels**: `high`, `medium`, `low`

## WebSocket Messages

When anomalies are detected, the system sends:

```json
{
  "type": "ANOMALY_ALERT",
  "message": "ANOMALY DETECTED:\n- finnhub_BTC_price: ...",
  "anomalies": [
    {
      "metric": "finnhub_BTC_price",
      "current_value": 100500.0,
      "anomaly_type": "sudden_change",
      "severity": "high",
      "context": "Finnhub BTC price anomaly: $100,500.00",
      "source": "finnhub",
      "symbol": "BTC"
    }
  ],
  "count": 1,
  "timestamp": "2024-01-01T12:00:00"
}
```

## Integration with AI Agent

The anomaly alert will:
1. Send WebSocket message to frontend
2. Frontend can inject system message into agent conversation
3. Agent processes the alert and can take actions (lock account, check holdings, etc.)

## Example Output

```
🚨 ANOMALY DETECTED: finnhub_BTC_price changed 4.15% suddenly (96500.00 → 100500.00) (severity: high)
🚨 1 significant anomaly(ies) detected, pinging agent
✅ ANOMALY_ALERT sent via WebSocket
```

