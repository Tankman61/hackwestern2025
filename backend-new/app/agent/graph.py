"""
LangGraph Agent Graph
Defines the agent execution flow with tools, checkpointing, and interrupts
"""
import os
from typing import Literal
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from app.agent.state import AgentState
from app.agent.personality import SYSTEM_PROMPT
from app.agent.tools import ALL_TOOLS


# Initialize LLM with tool binding
llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0.7,
    api_key=os.getenv("OPENAI_API_KEY")
)

# Bind tools to LLM
llm_with_tools = llm.bind_tools(ALL_TOOLS)


def call_agent(state: AgentState) -> AgentState:
    """
    Main agent node: calls GPT-4o with tools
    """
    messages = list(state["messages"])

    # ALWAYS ensure personality prompt is first, even if there's already a SystemMessage (alert)
    # This fixes the bug where system alerts override the personality prompt
    # Result: Agent will have BOTH personality + alert context
    has_personality = (
        messages and
        isinstance(messages[0], SystemMessage) and
        messages[0].content.startswith("You are Akira")  # Check if it's our personality
    )

    if not has_personality:
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + list(messages)

    # Call LLM with tools
    response = llm_with_tools.invoke(messages)

    # Return updated state
    return {
        **state,
        # Keep history plus the new agent response
        "messages": messages + [response],
    }


def should_continue(state: AgentState) -> Literal["tools", "end"]:
    """
    Router: decides whether to call tools or end conversation
    """
    messages = state["messages"]
    last_message = messages[-1]

    # If agent wants to use tools, continue to tools node
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"

    # Otherwise end the conversation
    return "end"


async def call_tools(state: AgentState) -> AgentState:
    """
    Tool execution node: runs the tools requested by the agent
    """
    messages = list(state["messages"])
    last_message = messages[-1]

    # Execute each tool call
    tool_messages = []
    for tool_call in last_message.tool_calls:
        # Find the matching tool
        tool = next((t for t in ALL_TOOLS if t.name == tool_call["name"]), None)

        if tool:
            # Execute tool with provided arguments (async)
            result = await tool.ainvoke(tool_call["args"])

            # Create tool message with result
            from langchain_core.messages import ToolMessage
            tool_messages.append(
                ToolMessage(
                    content=str(result),
                    tool_call_id=tool_call["id"],
                    name=tool_call["name"]
                )
            )
        else:
            # Tool not found
            from langchain_core.messages import ToolMessage
            tool_messages.append(
                ToolMessage(
                    content=f"ERROR: Tool '{tool_call['name']}' not found",
                    tool_call_id=tool_call["id"],
                    name=tool_call["name"]
                )
            )

    # Preserve history and append tool results so the agent can see them next step
    return {
        **state,
        "messages": messages + tool_messages,
    }


# Build the graph
def create_agent_graph():
    """
    Creates and compiles the LangGraph agent
    """
    # Initialize graph with AgentState
    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("agent", call_agent)
    workflow.add_node("tools", call_tools)

    # Set entry point
    workflow.set_entry_point("agent")

    # Add conditional edge from agent
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            "end": END,
        }
    )

    # Add edge from tools back to agent
    workflow.add_edge("tools", "agent")

    # Add checkpointing for conversation memory
    memory = MemorySaver()

    # Compile the graph
    app = workflow.compile(checkpointer=memory)

    return app


# Create the agent graph
agent_graph = create_agent_graph()
