"""
Trigger Monitor Worker
Runs every 1 second
Calculates: risk_score from latest market_context
Triggers: INTERRUPT when risk_score > 80
"""

# TODO: Implement trigger monitor worker
# - Read latest market_context
# - Calculate risk_score (formula in architecture doc)
# - If score > 80: generate alert with LLM
# - Send INTERRUPT via WebSocket
# - Inject SYSTEM_ALERT into agent conversation
# - Loop every 1 second
