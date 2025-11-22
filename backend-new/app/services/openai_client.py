"""
OpenAI client for LLM operations
- Data processing (GPT-4o-mini)
- Agent brain (GPT-4o)
"""
import os
import json
import logging
from typing import Dict, Any, Optional
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)


class OpenAIClient:
    """Wrapper around OpenAI client with helper methods"""
    
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY must be set")
        
        self.client = AsyncOpenAI(api_key=api_key)
        self.cheap_model = "gpt-4o-mini"
        self.smart_model = "gpt-4o"
        logger.info("✅ OpenAI client initialized")
    
    async def analyze_market_data(
        self, 
        btc_price: float,
        price_change_24h: float,
        polymarket_markets: list,
        reddit_posts: list
    ) -> Dict[str, Any]:
        """
        Analyze market data and return structured insights.
        Uses GPT-4o-mini for cost efficiency.
        
        Returns:
            {
                "hype_score": int (0-100),
                "sentiment": str ("BULLISH" | "BEARISH" | "PANIC"),
                "keywords": list[str],
                "polymarket_summary": str,
                "summary": str,
                "sentiment_bullish": int,
                "sentiment_bearish": int
            }
        """
        try:
            prompt = f"""Analyze this market data and return a JSON response.

BTC Price: ${btc_price:,.2f}
24h Change: {price_change_24h:+.2f}%

Polymarket Markets:
{json.dumps(polymarket_markets, indent=2)}

Reddit Posts with Comments (sample of {len(reddit_posts[:10])} posts):
{json.dumps(reddit_posts[:10], indent=2)}

CRITICAL: Each post includes "top_comments" with comment text, score, and upvote_ratio.
- High upvote_ratio (>0.7) + positive score = strong community agreement
- Low upvote_ratio (<0.3) + negative score = strong disagreement/bearish
- Comments with high scores carry more weight in sentiment analysis

Analyze the data and return ONLY a JSON object with this structure:
{{
  "hype_score": <0-100, how hyped is the market>,
  "sentiment": "<BULLISH|BEARISH|PANIC>",
  "keywords": ["<top", "keywords", "from", "posts", "and", "comments>"],
  "polymarket_summary": "<one sentence about prediction market odds>",
  "summary": "<2-3 sentence market summary INCLUDING insights from highly-upvoted comments>",
  "sentiment_bullish": <count of bullish posts AND highly-upvoted bullish comments>,
  "sentiment_bearish": <count of bearish/panic posts AND highly-upvoted bearish comments>
}}

Analysis Guidelines:
1. Price movement direction and magnitude
2. Polymarket odds (high odds = bullish, low/collapsing = bearish)
3. Reddit POST sentiment (keywords like "moon", "YOLO" = bullish, "dump", "rekt" = bearish)
4. **Reddit COMMENT sentiment weighted by upvote_ratio and score**:
   - Comments with score > 10 and upvote_ratio > 0.7 = strong community sentiment
   - Comments with score < -5 = bearish/controversial
   - Ignore low-engagement comments (score < 3)
5. PANIC sentiment if: price dropping >3% AND negative Reddit + collapsing odds + highly-upvoted panic comments"""

            response = await self.client.chat.completions.create(
                model=self.cheap_model,
                messages=[
                    {"role": "system", "content": "You are a market analyst. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            content = response.choices[0].message.content.strip()
            
            # Parse JSON response
            try:
                result = json.loads(content)
            except json.JSONDecodeError:
                # Try to extract JSON from markdown code blocks
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0].strip()
                result = json.loads(content)
            
            # Validate and normalize
            result["hype_score"] = max(0, min(100, int(result.get("hype_score", 50))))
            result["sentiment"] = result.get("sentiment", "BEARISH").upper()
            if result["sentiment"] not in ["BULLISH", "BEARISH", "PANIC"]:
                result["sentiment"] = "BEARISH"
            
            result["sentiment_bullish"] = max(0, int(result.get("sentiment_bullish", 0)))
            result["sentiment_bearish"] = max(0, int(result.get("sentiment_bearish", 0)))
            
            logger.info(f"✅ Market analysis: sentiment={result['sentiment']}, hype={result['hype_score']}")
            return result
            
        except Exception as e:
            logger.error(f"❌ OpenAI analysis failed: {e}")
            # Return fallback heuristic analysis
            return self._fallback_analysis(btc_price, price_change_24h, reddit_posts)
    
    def _fallback_analysis(
        self, 
        btc_price: float, 
        price_change_24h: float, 
        reddit_posts: list
    ) -> Dict[str, Any]:
        """Fallback heuristic analysis when LLM fails"""
        # Simple keyword-based sentiment
        bullish_keywords = ["moon", "bullish", "buy", "pump", "breakout", "yolo", "calls"]
        bearish_keywords = ["dump", "bearish", "sell", "crash", "rekt", "puts", "short"]
        
        bullish_count = 0
        bearish_count = 0
        
        for post in reddit_posts:
            # Analyze post title
            title = post.get("title", "").lower()
            for word in bullish_keywords:
                if word in title:
                    bullish_count += 1
                    break
            for word in bearish_keywords:
                if word in title:
                    bearish_count += 1
                    break
            
            # Analyze comments (weighted by upvote ratio)
            comments = post.get("top_comments", [])
            for comment in comments:
                body = comment.get("body", "").lower()
                score = comment.get("score", 0)
                upvote_ratio = comment.get("upvote_ratio", 0.5)
                
                # Only consider comments with engagement
                if score < 3:
                    continue
                
                # Weight by upvote ratio (high ratio = strong agreement)
                weight = 1 if upvote_ratio > 0.7 else 0.5
                
                is_bullish = any(word in body for word in bullish_keywords)
                is_bearish = any(word in body for word in bearish_keywords)
                
                if is_bullish:
                    bullish_count += weight
                elif is_bearish:
                    bearish_count += weight
        
        # Determine sentiment
        if price_change_24h < -3:
            sentiment = "PANIC"
            hype_score = 20
        elif price_change_24h < 0:
            sentiment = "BEARISH"
            hype_score = 40
        else:
            sentiment = "BULLISH"
            hype_score = 60
        
        return {
            "hype_score": hype_score,
            "sentiment": sentiment,
            "keywords": bullish_keywords[:3] if sentiment == "BULLISH" else bearish_keywords[:3],
            "polymarket_summary": "Polymarket data unavailable",
            "summary": f"Bitcoin at ${btc_price:,.2f}, {price_change_24h:+.2f}% (24h). Using fallback analysis with comment sentiment.",
            "sentiment_bullish": int(bullish_count),
            "sentiment_bearish": int(bearish_count)
        }
    
    async def generate_alert_message(self, market_context: Dict[str, Any]) -> str:
        """
        Generate urgent alert message for high risk scenarios.
        Uses GPT-4o-mini for speed.
        
        Args:
            market_context: Latest market_context data
            
        Returns:
            Brief urgent alert string
        """
        try:
            prompt = f"""Generate a BRIEF urgent alert (1-2 sentences max) for this market situation:

Risk Score: {market_context.get('risk_score', 0)}/100
BTC Price: ${market_context.get('btc_price', 0):,.2f}
24h Change: {market_context.get('price_change_24h', 0):+.2f}%
Sentiment: {market_context.get('sentiment', 'UNKNOWN')}
Polymarket Avg Odds: {market_context.get('polymarket_avg_odds', 0):.2f}

Write a brief, urgent alert message about what's happening. Be direct and alarming if risk is high."""

            response = await self.client.chat.completions.create(
                model=self.cheap_model,
                messages=[
                    {"role": "system", "content": "You are an urgent market alert system. Be brief and direct."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                max_tokens=100
            )
            
            alert = response.choices[0].message.content.strip()
            logger.info(f"✅ Generated alert: {alert[:50]}...")
            return alert
            
        except Exception as e:
            logger.error(f"❌ Alert generation failed: {e}")
            # Fallback alert
            change = market_context.get('price_change_24h', 0)
            if change < -3:
                return f"URGENT: Bitcoin dumping {change:+.1f}%! Market panic detected!"
            else:
                return f"ALERT: High risk detected. Bitcoin {change:+.1f}% (24h)."


# Global singleton
_openai_client: Optional[OpenAIClient] = None


def get_openai_client() -> OpenAIClient:
    """Get or create the OpenAI client singleton."""
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAIClient()
    return _openai_client
