"""
Trigger Monitor Worker
Runs every 1 second
Calculates: risk_score from latest market_context
Triggers: INTERRUPT when risk_score > 80
"""
import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from app.services.supabase import get_supabase
from app.services.openai_client import get_openai_client

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class TriggerMonitorWorker:
    """
    Background worker that monitors risk and triggers alerts.
    Runs every 1 second.
    
    CRITICAL RESPONSIBILITIES:
    1. Read latest market_context
    2. Calculate risk_score using weighted formula
    3. Update market_context with calculated risk_score
    4. If risk_score > 80: trigger INTERRUPT
    """
    
    def __init__(self, websocket_manager=None):
        self.db = get_supabase()
        self.openai = get_openai_client()
        self.ws_manager = websocket_manager  # For sending WebSocket alerts
        
        self.interval_seconds = 1
        self.is_running = False
        self._last_alert_time = None
        self._alert_cooldown_seconds = 30  # Don't spam alerts
        
        logger.info("✅ Trigger Monitor Worker initialized")
    
    async def start(self):
        """Start the worker loop"""
        self.is_running = True
        logger.info("🚀Trigger Monitor Worker started (interval: 1s)")
        
        while self.is_running:
            try:
                await self._run_cycle()
            except Exception as e:
                logger.error(f"❌ Monitor cycle failed: {e}", exc_info=True)
            
            # Wait 1 second before next cycle
            await asyncio.sleep(self.interval_seconds)
    
    async def stop(self):
        """Stop the worker loop"""
        self.is_running = False
        logger.info("🛑 Trigger Monitor Worker stopped")
    
    async def _run_cycle(self):
        """Run a single monitor cycle"""
        # STEP 1: Read latest market_context
        context = await self.db.get_latest_market_context()
        
        if not context:
            logger.debug("No market_context available yet")
            return
        
        # STEP 2: Calculate risk_score using weighted formula
        risk_score = self._calculate_risk_score(context)
        
        # STEP 3: Update market_context with calculated risk_score
        try:
            await self.db.update_market_context_risk_score(context["id"], risk_score)
            logger.debug(f"Updated risk_score: {risk_score}/100")
        except Exception as e:
            logger.error(f"Failed to update risk_score: {e}")
        
        # STEP 4: Check if we should trigger an alert
        if risk_score >= 80:
            await self._trigger_alert(context, risk_score)
    
    def _calculate_risk_score(self, context: Dict[str, Any]) -> int:
        """
        Calculate risk_score using weighted formula:
        - Sentiment component: 30%
        - Technical component: 30%
        - Polymarket component: 40%
        
        Returns:
            Risk score (0-100)
        """
        # Sentiment component (30%)
        # Based on sentiment_score (net bullish - bearish)
        sentiment_score = int(context.get("sentiment_score", 0))
        # Normalize to 0-100 scale (more negative = higher risk)
        if sentiment_score < -10:
            sentiment_component = 90
        elif sentiment_score < -5:
            sentiment_component = 70
        elif sentiment_score < 0:
            sentiment_component = 50
        elif sentiment_score < 5:
            sentiment_component = 30
        else:
            sentiment_component = 10
        
        sentiment_weighted = sentiment_component * 0.3
        
        # Technical component (30%)
        # Based on price_change_24h (larger negative change = higher risk)
        price_change = float(context.get("price_change_24h", 0))
        if price_change <= -5:
            technical_component = 100
        elif price_change <= -3:
            technical_component = 80
        elif price_change <= -1:
            technical_component = 60
        elif price_change < 0:
            technical_component = 40
        elif price_change < 3:
            technical_component = 20
        else:
            technical_component = 10
        
        technical_weighted = technical_component * 0.3
        
        # Polymarket component (40%)
        # Based on divergence from 0.5 (neutral odds)
        # Lower odds (< 0.3) or very high odds (> 0.8) = extreme = higher risk
        polymarket_avg_odds = float(context.get("polymarket_avg_odds", 0.5))
        divergence = abs(polymarket_avg_odds - 0.5)
        
        if divergence > 0.35:  # Very extreme odds (< 0.15 or > 0.85)
            polymarket_component = 90
        elif divergence > 0.25:  # Extreme odds
            polymarket_component = 70
        elif divergence > 0.15:  # Moderate divergence
            polymarket_component = 50
        else:  # Near neutral
            polymarket_component = 30
        
        # If odds are collapsing (< 0.3), increase risk more
        if polymarket_avg_odds < 0.3:
            polymarket_component = min(100, polymarket_component + 20)
        
        polymarket_weighted = polymarket_component * 0.4
        
        # Calculate total risk score
        risk_score = sentiment_weighted + technical_weighted + polymarket_weighted
        
        # Additional boost if sentiment is PANIC
        if context.get("sentiment") == "PANIC":
            risk_score = min(100, risk_score + 15)
        
        # Clamp to 0-100
        risk_score = max(0, min(100, int(risk_score)))
        
        logger.debug(
            f"Risk calculation: sentiment={sentiment_weighted:.1f}, "
            f"technical={technical_weighted:.1f}, "
            f"polymarket={polymarket_weighted:.1f}, "
            f"total={risk_score}"
        )
        
        return risk_score
    
    async def _trigger_alert(self, context: Dict[str, Any], risk_score: int):
        """
        Trigger an INTERRUPT alert when risk is high.
        
        Args:
            context: Latest market_context data
            risk_score: Calculated risk score
        """
        # Check cooldown to avoid spam
        now = datetime.utcnow()
        if self._last_alert_time:
            time_since_last_alert = (now - self._last_alert_time).total_seconds()
            if time_since_last_alert < self._alert_cooldown_seconds:
                logger.debug(f"Alert on cooldown ({time_since_last_alert:.0f}s < {self._alert_cooldown_seconds}s)")
                return
        
        logger.warning(f"🚨 HIGH RISK DETECTED: {risk_score}/100")
        
        # Update last alert time
        self._last_alert_time = now
        
        # Generate alert message with LLM
        alert_message = await self.openai.generate_alert_message({
            "risk_score": risk_score,
            "btc_price": context.get("btc_price", 0),
            "price_change_24h": context.get("price_change_24h", 0),
            "sentiment": context.get("sentiment", "UNKNOWN"),
            "polymarket_avg_odds": context.get("polymarket_avg_odds", 0.5)
        })
        
        logger.warning(f"🚨 Alert message: {alert_message}")
        
        # Send WebSocket INTERRUPT if manager is available
        if self.ws_manager:
            try:
                await self.ws_manager.broadcast({
                    "type": "INTERRUPT",
                    "message": alert_message,
                    "risk_score": risk_score,
                    "btc_price": context.get("btc_price", 0),
                    "price_change_24h": context.get("price_change_24h", 0)
                })
                logger.info("✅ INTERRUPT broadcast sent via WebSocket")
            except Exception as e:
                logger.error(f"Failed to send WebSocket INTERRUPT: {e}")
        else:
            logger.warning("⚠️  No WebSocket manager available, alert not broadcast")
        
        # TODO: Inject SYSTEM_ALERT into agent conversation
        # This would require integration with the agent graph state
        # For now, the WebSocket INTERRUPT is sufficient for MVP


async def run_monitor_worker(websocket_manager=None):
    """
    Entry point to run the trigger monitor worker.
    
    Args:
        websocket_manager: Optional WebSocket manager for broadcasting alerts
    """
    worker = TriggerMonitorWorker(websocket_manager=websocket_manager)
    try:
        await worker.start()
    except KeyboardInterrupt:
        logger.info("🛑 Received shutdown signal")
        await worker.stop()


if __name__ == "__main__":
    # For standalone testing
    asyncio.run(run_monitor_worker())
