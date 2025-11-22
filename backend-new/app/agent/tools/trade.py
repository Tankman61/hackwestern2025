"""
Tool: execute_trade()
Initiates a trade on behalf of the agent
CRITICAL: interrupt_before=True - pauses for user approval
"""

# TODO: Implement execute_trade tool
# - Parameters: ticker, side, order_type, amount, limit_price
# - Insert into trades with status='PENDING_APPROVAL'
# - Send APPROVAL_REQUEST via WebSocket
# - Wait for user decision
# - If approved: update to OPEN, update balance
# - If denied: delete trade, return cancellation message
