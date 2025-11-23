"""
Generate PNG visualization of the agent graph
Run: python visualize_graph.py
"""
from app.agent.graph import agent_graph

# Generate the visualization
try:
    # Get the graph visualization as PNG
    png_data = agent_graph.get_graph().draw_mermaid_png()

    # Save to file
    with open("agent_graph.png", "wb") as f:
        f.write(png_data)

    print("✅ Graph visualization saved to: agent_graph.png")
    print("\nGraph structure:")
    print("- Entry: agent node")
    print("- agent → (if tool_calls) → tools → agent")
    print("- agent → (if no tool_calls) → END")
    print("\nNodes:")
    print("  1. agent: Calls GPT-4o with tools")
    print("  2. tools: Executes tool calls (async)")
    print("\nTools available:")
    from app.agent.tools import ALL_TOOLS
    for tool in ALL_TOOLS:
        print(f"  - {tool.name}")

except Exception as e:
    print(f"❌ Error generating graph: {e}")
    print("\nTrying alternative method (Mermaid text)...")

    try:
        # Get mermaid diagram as text
        mermaid = agent_graph.get_graph().draw_mermaid()

        print("\nMermaid diagram:")
        print("=" * 60)
        print(mermaid)
        print("=" * 60)
        print("\nCopy the above to https://mermaid.live/ to visualize")

    except Exception as e2:
        print(f"❌ Also failed: {e2}")