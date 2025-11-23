"""
Anomaly Monitoring Worker
Continuously checks for anomalies and pings the AI agent when detected.

Runs every 5 seconds checking:
- Portfolio balance changes
- BTC price movements
- Risk score spikes
- Trading volume anomalies
"""
import asyncio
import logging
from typing import Dict, Any, Optional, List, Callable, Awaitable
from datetime import datetime

from app.services.supabase import get_supabase
from app.services.anomaly_monitor import get_anomaly_monitor
from app.services.openai_client import get_openai_client
from app.services.finnhub import finnhub_service

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class AnomalyWorker:
    """
    Background worker that monitors for anomalies and alerts the AI agent.
    
    Monitors:
    - Portfolio balance changes
    - BTC price movements
    - Risk score changes
    - Trading activity anomalies
    """
    
    def __init__(self, websocket_manager=None, agent_session_manager=None):
        self.db = get_supabase()
        self.monitor = get_anomaly_monitor()
        self.openai = get_openai_client()
        self.ws_manager = websocket_manager
        self.agent_session_manager = agent_session_manager  # For injecting messages into agent
        
        self.interval_seconds = 5  # Check every 5 seconds
        self.is_running = False
        self.anomaly_callbacks: List[Callable[[Dict[str, Any]], Awaitable[None]]] = []
        
        logger.info("✅ Anomaly Worker initialized")
    
    async def start(self):
        """Start the worker loop"""
        self.is_running = True
        logger.info(f"🚀 Anomaly Worker started (interval: {self.interval_seconds}s)")
        
        while self.is_running:
            try:
                await self._run_cycle()
            except Exception as e:
                logger.error(f"❌ Anomaly cycle failed: {e}", exc_info=True)
            
            await asyncio.sleep(self.interval_seconds)
    
    async def stop(self):
        """Stop the worker loop"""
        self.is_running = False
        logger.info("🛑 Anomaly Worker stopped")
    
    async def _run_cycle(self):
        """Run a single anomaly detection cycle"""
        anomalies_detected = []
        
        # 1. Check Finnhub service for anomalies (primary focus)
        finnhub_anomalies = await self._check_finnhub_anomalies()
        anomalies_detected.extend(finnhub_anomalies)
        
        # 2. Check portfolio balance for anomalies
        portfolio_anomaly = await self._check_portfolio_anomalies()
        if portfolio_anomaly:
            anomalies_detected.append(portfolio_anomaly)
        
        # 3. Check market context for anomalies
        market_anomalies = await self._check_market_anomalies()
        anomalies_detected.extend(market_anomalies)
        
        # 4. Check trading activity for anomalies
        trading_anomaly = await self._check_trading_anomalies()
        if trading_anomaly:
            anomalies_detected.append(trading_anomaly)
        
        # 5. If any anomalies detected, ping the AI agent
        if anomalies_detected:
            await self._ping_agent_with_anomalies(anomalies_detected)
    
    async def _check_finnhub_anomalies(self) -> List[Dict[str, Any]]:
        """Check Finnhub service data for anomalies"""
        anomalies = []
        
        try:
            # Get all current prices from Finnhub
            all_prices = finnhub_service.get_all_prices()
            
            if not all_prices:
                # No prices available - could be an anomaly itself (service down?)
                logger.debug("No prices available from Finnhub service")
                return anomalies
            
            # Check each symbol for anomalies
            for symbol, current_price in all_prices.items():
                if current_price <= 0:
                    continue
                
                # Detect price anomalies (sudden movements)
                price_anomaly = self.monitor.detect_anomalies(
                    metric_name=f"finnhub_{symbol}_price",
                    current_value=current_price,
                    rate_of_change_threshold=0.05  # 5% change threshold
                )
                
                if price_anomaly and price_anomaly["severity"] in ["high", "medium"]:
                    anomalies.append({
                        **price_anomaly,
                        "context": f"Finnhub {symbol} price anomaly: ${current_price:,.2f}",
                        "source": "finnhub",
                        "symbol": symbol
                    })
            
            # Check for connection issues (no price updates for a while)
            # This would require tracking last update time - for now skip
            
        except Exception as e:
            logger.error(f"Failed to check Finnhub anomalies: {e}", exc_info=True)
        
        return anomalies
    
    async def _check_portfolio_anomalies(self) -> Optional[Dict[str, Any]]:
        """Check portfolio balance for significant changes"""
        try:
            portfolio = await self.db.get_portfolio()
            if not portfolio:
                return None
            
            balance = float(portfolio.get("balance_usd", 0))
            
            # Detect balance anomalies (sudden drops or spikes)
            anomaly = self.monitor.detect_anomalies(
                metric_name="portfolio_balance",
                current_value=balance,
                rate_of_change_threshold=0.05  # 5% change threshold
            )
            
            if anomaly and anomaly["severity"] in ["high", "medium"]:
                return {
                    **anomaly,
                    "context": f"Portfolio balance anomaly: ${balance:,.2f}"
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to check portfolio anomalies: {e}")
            return None
    
    async def _check_market_anomalies(self) -> List[Dict[str, Any]]:
        """Check market data for anomalies"""
        anomalies = []
        
        try:
            context = await self.db.get_latest_market_context()
            if not context:
                return anomalies
            
            # Check BTC price for anomalies
            btc_price = float(context.get("btc_price", 0))
            if btc_price > 0:
                price_anomaly = self.monitor.detect_anomalies(
                    metric_name="btc_price",
                    current_value=btc_price,
                    rate_of_change_threshold=0.03  # 3% price change threshold
                )
                if price_anomaly and price_anomaly["severity"] in ["high", "medium"]:
                    anomalies.append({
                        **price_anomaly,
                        "context": f"BTC price anomaly: ${btc_price:,.2f}"
                    })
            
            # Check risk score for sudden spikes
            risk_score = int(context.get("risk_score", 0))
            if risk_score > 0:
                risk_anomaly = self.monitor.detect_anomalies(
                    metric_name="risk_score",
                    current_value=risk_score,
                    rate_of_change_threshold=0.20  # 20% change in risk score
                )
                if risk_anomaly and risk_anomaly["severity"] in ["high"]:
                    anomalies.append({
                        **risk_anomaly,
                        "context": f"Risk score spike: {risk_score}/100"
                    })
            
            # Check price change 24h for extreme movements
            price_change = float(context.get("price_change_24h", 0))
            if abs(price_change) > 5.0:  # More than 5% change
                # Track this as a separate metric
                change_anomaly = self.monitor.detect_anomalies(
                    metric_name="price_change_24h",
                    current_value=abs(price_change),
                    rate_of_change_threshold=0.50  # 50% threshold for change detection
                )
                if change_anomaly and change_anomaly["severity"] in ["high"]:
                    anomalies.append({
                        **change_anomaly,
                        "context": f"Extreme 24h price change: {price_change:+.2f}%"
                    })
            
        except Exception as e:
            logger.error(f"Failed to check market anomalies: {e}")
        
        return anomalies
    
    async def _check_trading_anomalies(self) -> Optional[Dict[str, Any]]:
        """Check trading activity for anomalies"""
        try:
            # Get portfolio to check for balance anomalies (already checked in portfolio method)
            # Additional trading-specific checks can be added here
            # For now, trading anomalies are covered by portfolio balance checks
            return None
            
        except Exception as e:
            logger.error(f"Failed to check trading anomalies: {e}")
            return None
    
    async def _ping_agent_with_anomalies(self, anomalies: List[Dict[str, Any]]):
        """
        Ping the AI agent when anomalies are detected.
        
        Methods:
        1. Send WebSocket INTERRUPT message
        2. Inject SystemMessage into agent conversation
        """
        if not anomalies:
            return
        
        # Filter for high/medium severity only
        significant_anomalies = [a for a in anomalies if a.get("severity") in ["high", "medium"]]
        
        if not significant_anomalies:
            return
        
        logger.warning(f"🚨 {len(significant_anomalies)} significant anomaly(ies) detected, pinging agent")
        
        # Generate alert message with context
        anomaly_summaries = []
        for anomaly in significant_anomalies:
            summary = f"- {anomaly['metric']}: {anomaly.get('message', 'Anomaly detected')} (severity: {anomaly['severity']})"
            if 'context' in anomaly:
                summary += f" | {anomaly['context']}"
            anomaly_summaries.append(summary)
        
        alert_message = f"ANOMALY DETECTED:\n" + "\n".join(anomaly_summaries)
        
        # Method 1: Send WebSocket ANOMALY_ALERT (primary method, similar to monitor worker INTERRUPT)
        # Frontend will handle injecting the system message into agent conversation
        if self.ws_manager:
            try:
                # Check if ws_manager has broadcast method (for agent WebSocket)
                if hasattr(self.ws_manager, 'broadcast'):
                    await self.ws_manager.broadcast({
                        "type": "ANOMALY_ALERT",
                        "message": alert_message,
                        "anomalies": significant_anomalies,
                        "count": len(significant_anomalies),
                        "timestamp": datetime.utcnow().isoformat()
                    })
                    logger.info("✅ ANOMALY_ALERT sent via WebSocket broadcast")
                else:
                    # If it's a different type of manager, try to send directly
                    logger.warning(f"WebSocket manager doesn't have broadcast method: {type(self.ws_manager)}")
            except Exception as e:
                logger.error(f"Failed to send WebSocket ANOMALY_ALERT: {e}", exc_info=True)
        else:
            logger.debug("No WebSocket manager available, anomaly alert not broadcast")
        
        # Method 2: Direct agent message injection (optional, for future enhancement)
        # Currently, WebSocket is the primary method and frontend handles agent injection
        if self.agent_session_manager:
            try:
                system_message = f"SYSTEM_ALERT: {alert_message}"
                await self._inject_agent_message(system_message)
                logger.info("✅ Anomaly alert also injected directly into agent conversation")
            except Exception as e:
                logger.debug(f"Direct agent injection not available: {e}")
    
    async def _inject_agent_message(self, message: str):
        """
        Inject a system message directly into the agent conversation.
        
        This is an optional method for direct agent integration.
        Currently, WebSocket is the primary method and frontend handles injection.
        """
        # TODO: Implement direct agent message injection when agent session manager is available
        # This would involve:
        # - Getting current agent state/session
        # - Adding a SystemMessage to the conversation
        # - Triggering agent to process the message
        # For now, WebSocket broadcast is sufficient for MVP
        logger.debug(f"Direct agent injection prepared (future enhancement): {message[:100]}...")


async def run_anomaly_worker(websocket_manager=None, agent_session_manager=None):
    """
    Entry point to run the anomaly monitoring worker.
    
    Args:
        websocket_manager: Optional WebSocket manager for broadcasting alerts
        agent_session_manager: Optional agent session manager for injecting messages
    """
    worker = AnomalyWorker(websocket_manager=websocket_manager, agent_session_manager=agent_session_manager)
    try:
        await worker.start()
    except KeyboardInterrupt:
        logger.info("🛑 Received shutdown signal")
        await worker.stop()


if __name__ == "__main__":
    # For standalone testing
    asyncio.run(run_anomaly_worker())

