"""
Test script for Anomaly Worker
Tests anomaly detection and triggers alerts via HTTP endpoint

Usage:
    python test_anomaly_worker.py
    
Make sure FastAPI is running before executing this test.
The test will call the FastAPI endpoint to trigger anomaly alerts
that will appear on the frontend.
"""
import asyncio
import sys
import os
import httpx
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from app.services.anomaly_monitor import AnomalyMonitor


API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")


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


async def test_trigger_anomaly_via_api():
    """Test triggering an anomaly alert via HTTP endpoint"""
    print("\n" + "=" * 60)
    print("🧪 Testing Anomaly Alert via HTTP API")
    print("=" * 60)
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Test 1: Custom test anomaly
            print("\n📡 Triggering custom test anomaly...")
            response = await client.post(
                f"{API_BASE_URL}/api/test/anomaly",
                json={
                    "message": "BTC price spike detected in test",
                    "severity": "high",
                    "anomaly_type": "sudden_change",
                    "metric": "btc_price"
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Alert sent successfully!")
                print(f"   📡 Connected clients: {result.get('connections', 0)}")
                if result.get('success'):
                    print("   👀 Check your frontend - the alert should appear now!")
                else:
                    print("   ⚠️  No active WebSocket connections")
            else:
                print(f"   ❌ Failed with status {response.status_code}: {response.text}")
            
            # Wait a bit between requests
            await asyncio.sleep(2)
            
            # Test 2: Simulated realistic anomaly
            print("\n📡 Triggering simulated realistic anomaly...")
            response = await client.post(
                f"{API_BASE_URL}/api/test/anomaly/simulated"
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Simulated alert sent successfully!")
                print(f"   📡 Connected clients: {result.get('connections', 0)}")
                if result.get('success'):
                    print("   👀 Check your frontend - the alert should appear now!")
                    if 'anomaly' in result:
                        anomaly = result['anomaly']
                        print(f"   📊 Anomaly details: {anomaly.get('message', 'N/A')}")
                        print(f"   🔴 Severity: {anomaly.get('severity', 'N/A')}")
                else:
                    print("   ⚠️  No active WebSocket connections")
            else:
                print(f"   ❌ Failed with status {response.status_code}: {response.text}")
                
    except httpx.ConnectError:
        print(f"\n   ❌ ERROR: Could not connect to FastAPI server at {API_BASE_URL}")
        print("   💡 Make sure FastAPI is running before executing this test!")
    except Exception as e:
        print(f"\n   ❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 60)


async def check_server_connection():
    """Check if the FastAPI server is running"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{API_BASE_URL}/health")
            if response.status_code == 200:
                return True
            return False
    except:
        return False


async def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("🚀 Anomaly Detection System Test Suite")
    print("=" * 60)
    print(f"\n🔗 API Base URL: {API_BASE_URL}")
    
    # Check if server is running
    print("\n🔍 Checking server connection...")
    if await check_server_connection():
        print("   ✅ Server is running!")
    else:
        print(f"   ❌ Server is NOT running at {API_BASE_URL}")
        print("   💡 Please start FastAPI server first:")
        print("      cd backend-new")
        print("      ./run_fastapi.sh")
        print("\n   Exiting...")
        return
    
    try:
        # Test 1: Basic anomaly detection (local, no server needed)
        await test_anomaly_monitor()
        
        # Test 2: Trigger anomaly via HTTP API (requires server)
        await test_trigger_anomaly_via_api()
        
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
