"""
Terminal Test Script for LangGraph Agent
Tests Akira's conversation flow with tool calls
"""
import asyncio
from langchain_core.messages import HumanMessage
from app.agent.graph import agent_graph
from app.agent.state import AgentState


async def main():
    print("=" * 60)
    print("🎭 AKIRA AGENT - TERMINAL TEST")
    print("=" * 60)
    print("Type your messages. Type 'quit' to exit.\n")

    # Initialize conversation state
    config = {"configurable": {"thread_id": "test-session-1"}}
    initial_state: AgentState = {
        "messages": [],
        "risk_score": 0,
    "risk_level": "Unknown",
        "portfolio_locked": False,
        "lock_reason": None,
        "pending_trade_id": None,
        "requires_approval": False,
    }

    while True:
        # Get user input
        user_input = input("\n👤 You: ").strip()

        if user_input.lower() in ["quit", "exit", "q"]:
            print("\n👋 Exiting agent test. Goodbye!")
            break

        if not user_input:
            continue

        # Create human message
        human_message = HumanMessage(content=user_input)

        # Invoke agent graph
        print("\n🤖 Akira: ", end="", flush=True)

        try:
            # Stream the agent's response
            async for event in agent_graph.astream(
                {"messages": [human_message]},
                config=config,
                stream_mode="values"
            ):
                # Get the last message
                if "messages" in event and event["messages"]:
                    last_msg = event["messages"][-1]

                    # Print agent response
                    if hasattr(last_msg, "content") and last_msg.content:
                        # Don't print tool calls, just the final response
                        if not hasattr(last_msg, "tool_calls") or not last_msg.tool_calls:
                            print(last_msg.content, flush=True)

        except KeyboardInterrupt:
            print("\n\n⚠️ Interrupted by user")
            break
        except Exception as e:
            print(f"\n❌ Error: {str(e)}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    print("\n🔧 Starting agent test...\n")
    asyncio.run(main())