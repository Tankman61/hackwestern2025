"""
Test script for Anomaly Worker
Tests anomaly detection and broadcasts alerts to frontend via WebSocket

Usage:
    python test_anomaly_worker.py
    
Make sure FastAPI is running before executing this test.
The test will connect to the running FastAPI instance and broadcast
ANOMALY_ALERT messages that will appear on the frontend.
"""
import asyncio
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from app.services.anomaly_monitor import AnomalyMonitor
from app.workers.anomaly_worker import AnomalyWorker
from app.api.market_websocket import manager as ws_manager


class MockWebSocketManager:
    """Mock WebSocket manager that uses the real FastAPI ConnectionManager"""
    
    def __init__(self, connection_manager):
        self.connection_manager = connection_manager
    
    async def broadcast(self, message: dict):
        """Broadcast message to all crypto WebSocket connections"""
        # Broadcast to all crypto connections (BTC is the main one)
        await self.connection_manager.broadcast_to_subscribers(
            "crypto", 
            "BTC", 
            message
        )


async def test_anomaly_monitor():
    """Test the anomaly detection logic"""
    print("=" * 60)
    print("🧪 Testing Anomaly Monitor")
    print("=" * 60)
    
    monitor = AnomalyMonitor(window_size=5, z_score_threshold=2.5)
    
    # Simulate normal prices (baseline)
    print("\n📊 Building baseline with normal prices...")
    baseline_prices = [96500.00, 96550.00, 96520.00, 96530.00, 96540.00]
    for price in baseline_prices:
        monitor.add_metric_value("btc_price", price)
        print(f"   Added: ${price:,.2f}")
    
    # Test 1: Normal price (should not trigger)
    print("\n✅ Test 1: Normal price (should not trigger)")
    normal_price = 96580.00
    anomaly = monitor.detect_anomalies("btc_price", normal_price)
    if anomaly:
        print(f"   ❌ False positive! Anomaly detected: {anomaly['message']}")
    else:
        print(f"   ✅ Correct: No anomaly for ${normal_price:,.2f}")
    
    # Test 2: Sudden spike (should trigger)
    print("\n🚨 Test 2: Sudden spike (should trigger)")
    spike_price = 100500.00  # ~4% increase
    anomaly = monitor.detect_anomalies("btc_price", spike_price)
    if anomaly:
        print(f"   ✅ Anomaly detected: {anomaly['message']}")
        print(f"   Severity: {anomaly['severity']}, Type: {anomaly['anomaly_type']}")
    else:
        print(f"   ❌ False negative! Should have detected ${spike_price:,.2f}")
    
    # Test 3: Sudden drop (should trigger)
    print("\n🚨 Test 3: Sudden drop (should trigger)")
    drop_price = 92000.00  # ~4.5% decrease
    anomaly = monitor.detect_anomalies("btc_price", drop_price)
    if anomaly:
        print(f"   ✅ Anomaly detected: {anomaly['message']}")
        print(f"   Severity: {anomaly['severity']}, Type: {anomaly['anomaly_type']}")
    else:
        print(f"   ❌ False negative! Should have detected ${drop_price:,.2f}")
    
    # Test 4: Statistical outlier (should trigger)
    print("\n🚨 Test 4: Statistical outlier (should trigger)")
    outlier_price = 105000.00  # Far from baseline mean
    anomaly = monitor.detect_anomalies("btc_price", outlier_price)
    if anomaly:
        print(f"   ✅ Anomaly detected: {anomaly['message']}")
        print(f"   Z-score: {anomaly.get('z_score', 'N/A'):.2f}")
    else:
        print(f"   ❌ False negative! Should have detected ${outlier_price:,.2f}")
    
    print("\n" + "=" * 60)


async def test_anomaly_worker_cycle():
    """Test a single cycle of the anomaly worker"""
    print("\n" + "=" * 60)
    print("🧪 Testing Anomaly Worker Cycle")
    print("=" * 60)
    
    worker = AnomalyWorker()
    
    print("\n🔄 Running one cycle...")
    await worker._run_cycle()
    
    print("\n✅ Cycle complete!")
    print("   Check logs above for any anomalies detected")
    print("\n💡 What to look for:")
    print("   - Finnhub price anomalies")
    print("   - Portfolio balance changes")
    print("   - Market context anomalies")
    print("   - Trading activity anomalies")
    
    print("\n" + "=" * 60)


async def test_anomaly_broadcast_to_frontend():
    """Test broadcasting anomaly alerts to frontend via WebSocket"""
    print("\n" + "=" * 60)
    print("🧪 Testing Anomaly Broadcast to Frontend")
    print("=" * 60)
    
    # Create a mock monitor and inject anomalies
    monitor = AnomalyMonitor()
    
    # Build baseline
    print("\n📊 Building baseline...")
    for i in range(5):
        monitor.add_metric_value("btc_price", 96500.0 + i * 10)
    
    # Inject a significant anomaly
    print("\n🚨 Injecting anomaly...")
    anomaly = monitor.detect_anomalies("btc_price", 100500.0)  # ~4% spike
    
    if anomaly:
        print(f"   ✅ Anomaly detected!")
        print(f"   Message: {anomaly['message']}")
        print(f"   Type: {anomaly['anomaly_type']}")
        print(f"   Severity: {anomaly['severity']}")
        
        # Create mock WebSocket manager using real FastAPI connection manager
        mock_ws_manager = MockWebSocketManager(ws_manager)
        
        # Create worker with WebSocket manager
        print("\n🤖 Broadcasting anomaly alert to frontend...")
        worker = AnomalyWorker(websocket_manager=mock_ws_manager)
        
        # Format anomaly with context
        anomaly_with_context = {
            **anomaly,
            "context": f"Finnhub BTC price anomaly: $100,500.00",
            "source": "finnhub",
            "symbol": "BTC"
        }
        
        # Ping agent with anomaly (will broadcast via WebSocket)
        await worker._ping_agent_with_anomalies([anomaly_with_context])
        
        print("   ✅ Anomaly alert broadcasted!")
        print("   👀 Check your frontend - you should see the ANOMALY_ALERT message")
        
        # Check how many connections are active
        active_connections = len(ws_manager.active_connections.get("crypto", set()))
        print(f"   📡 Connected clients: {active_connections}")
        if active_connections == 0:
            print("   ⚠️  WARNING: No active WebSocket connections!")
            print("      Make sure your frontend is connected to /ws/alpaca/crypto")
    else:
        print("   ❌ Anomaly not detected")
    
    print("\n" + "=" * 60)


async def test_simulated_anomaly_broadcast():
    """Test sending a simulated anomaly alert directly to frontend"""
    print("\n" + "=" * 60)
    print("🧪 Testing Simulated Anomaly Broadcast")
    print("=" * 60)
    
    # Create mock WebSocket manager
    mock_ws_manager = MockWebSocketManager(ws_manager)
    
    # Create a simulated anomaly
    simulated_anomaly = {
        "metric": "btc_price",
        "current_value": 100500.0,
        "previous_value": 96500.0,
        "rate_of_change": 0.0414,
        "change_percent": 4.14,
        "anomaly_type": "sudden_change",
        "severity": "high",
        "message": "btc_price changed 4.14% suddenly (96500.00 → 100500.00)",
        "context": "Finnhub BTC price anomaly: $100,500.00",
        "source": "finnhub",
        "symbol": "BTC"
    }
    
    print("\n🚨 Creating simulated anomaly...")
    print(f"   Type: {simulated_anomaly['anomaly_type']}")
    print(f"   Severity: {simulated_anomaly['severity']}")
    print(f"   Message: {simulated_anomaly['message']}")
    
    # Create worker and broadcast
    print("\n📡 Broadcasting to frontend...")
    worker = AnomalyWorker(websocket_manager=mock_ws_manager)
    await worker._ping_agent_with_anomalies([simulated_anomaly])
    
    # Check connections
    active_connections = len(ws_manager.active_connections.get("crypto", set()))
    print(f"\n   ✅ Alert sent!")
    print(f"   📡 Active WebSocket connections: {active_connections}")
    if active_connections > 0:
        print("   👀 Check your frontend - the alert should appear now!")
    else:
        print("   ⚠️  No active connections - frontend may not be connected")
    
    print("\n" + "=" * 60)


async def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("🚀 Anomaly Detection System Test Suite")
    print("=" * 60)
    print("\n⚠️  Make sure FastAPI is running before executing this test!")
    print("   The test will broadcast alerts to connected frontend clients.\n")
    
    try:
        # Check if WebSocket manager is available
        active_connections = len(ws_manager.active_connections.get("crypto", set()))
        print(f"📡 Currently connected WebSocket clients: {active_connections}\n")
        
        # Test 1: Basic anomaly detection
        await test_anomaly_monitor()
        
        # Test 2: Single worker cycle (with real data)
        await test_anomaly_worker_cycle()
        
        # Test 3: Broadcast to frontend with real anomaly
        await test_anomaly_broadcast_to_frontend()
        
        # Test 4: Simulated anomaly broadcast
        await test_simulated_anomaly_broadcast()
        
        print("\n" + "=" * 60)
        print("✅ All tests completed!")
        print("=" * 60)
        print("\n💡 Tips:")
        print("   - If no alerts appeared on frontend, check WebSocket connection")
        print("   - Make sure frontend is subscribed to BTC on /ws/alpaca/crypto")
        print("   - Check browser console for ANOMALY_ALERT messages")
        
    except KeyboardInterrupt:
        print("\n\n🛑 Tests interrupted")
    except Exception as e:
        print(f"\n\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
