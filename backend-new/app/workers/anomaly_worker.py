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
from app.services.voice_session_manager import speak as voice_speak

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
    Applies a cooldown to avoid spamming voice alerts.
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
        self._last_alert_time: Dict[str, float] = {}
        self.alert_cooldown_seconds = 30
        
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
        """Check Finnhub service data for anomalies (disabled for jump-only demo)"""
        return []
    
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
            # Pull live price directly from Finnhub service (ignore ingest cadence)
            btc_price = finnhub_service.get_price("BTC") or finnhub_service.get_price("BTCUSD") or 0
            if btc_price > 0:
                base = 85000.0
                delta = btc_price - base
                delta_pct = (delta / base) * 100
                if btc_price <= 60000 or btc_price >= 100000:
                    anomalies.append({
                        "metric": "btc_price_threshold",
                        "value": btc_price,
                        "delta": delta,
                        "delta_pct": delta_pct,
                        "severity": "high",
                        "context": f"BTC at ${btc_price:,.2f} vs base ${base:,.2f}"
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
        """Send anomaly summary to the agent chat API"""
        if not anomalies:
            return

        significant_anomalies = [a for a in anomalies if a.get("severity") in ["high", "medium"]]
        # Only keep anomalies with jump info (delta/delta_pct)
        significant_anomalies = [a for a in significant_anomalies if "delta" in a and "delta_pct" in a]
        if not significant_anomalies:
            return

        # Cooldown: suppress repeated alerts for the same metric
        now = datetime.utcnow().timestamp()
        cooled = []
        for a in significant_anomalies:
            metric = a.get("metric", "unknown")
            last = self._last_alert_time.get(metric, 0)
            if now - last >= self.alert_cooldown_seconds:
                cooled.append(a)
                self._last_alert_time[metric] = now
        significant_anomalies = cooled
        if not significant_anomalies:
            logger.debug("All anomalies suppressed due to cooldown")
            return

        logger.warning(f"🚨 {len(significant_anomalies)} significant anomaly(ies) detected, pinging voice session")

        # Use the first jump anomaly for alert content (single-user demo)
        top_anomaly = significant_anomalies[0]

        btc_price = finnhub_service.get_price("BTC") or finnhub_service.get_price("BTCUSD") or 0
        risk_score = next((a.get("value") for a in significant_anomalies if a.get("metric") == "risk_score"), 0)
        hype_score = next((a.get("value") for a in significant_anomalies if a.get("metric") == "hype_score"), 0)

        delta_pct = top_anomaly.get('delta_pct', 0)
        delta = top_anomaly.get('delta', 0)

        alert_context = {
            "alert_type": "ANOMALY_ALERT",
            "risk_score": risk_score if risk_score else (95 if delta < 0 else 0),
            "hype_score": hype_score if hype_score else (95 if delta > 0 else 0),
            "btc_price": btc_price or 0,
            "price_change_24h": delta_pct,
        }

        alert_message = f"ALERT: BTC to {btc_price:,.0f} dollars. Move {delta:+,.0f} dollars ({delta_pct:+.2f}%). Base eighty five thousand. React now."

        delivered = await voice_speak(alert_message, alert_context)
        if delivered:
            logger.info("✅ Anomaly alert spoken via active voice session")
        else:
            logger.warning("⚠️ No active voice session to speak anomaly alert")
    
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
