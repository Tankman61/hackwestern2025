"""
Data Ingest Worker
Runs every 10 seconds
Fetches: CoinGecko, Polymarket, Reddit
Processes: Uses GPT-4o-mini to analyze
Writes: market_context + feed_items tables
"""

# TODO: Implement data ingest worker
# - Async fetch all 3 data sources in parallel
# - Process with OpenAI (hype_score, sentiment, keywords)
# - Insert into market_context
# - Upsert into feed_items (Polymarket + Reddit)
# - Loop every 10 seconds
