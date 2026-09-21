import asyncio
import json
import cognee
import os
from dotenv import load_dotenv
from backend.events import publish_graph_mutation, publish_timeline_event

load_dotenv()

# Set environment variables for Cognee to point to local instances ONLY if not using Cloud
if not os.getenv("COGNEE_API_KEY"):
    os.environ["MEMGRAPH_HOST"] = "localhost"
    os.environ["MEMGRAPH_PORT"] = "7687"

async def initialize_memory():
    """
    Initialize Cognee if necessary.
    """
    pass

async def add_to_graph(project_id: str, data: dict):
    """
    Extract, Cognify, Load (ECL) pipeline wrapper — non-blocking version.
    1. Immediately publishes the graph mutation so the UI updates instantly.
    2. Runs cognify() in the background for deep graph enrichment.
    """
    text_payload = json.dumps(data)
    node_type = data.get("type", "unknown")
    human_name = node_type.replace("_node", "").replace("_", " ").title()

    # 1. Immediately push graph mutation so the UI node renders now
    await publish_graph_mutation(project_id, node_type, data)

    # 2. Publish memory timeline event
    await publish_timeline_event(project_id, "remember", node_type, f"{human_name} context committed to long-term memory.")

    # 3. Add to Cognee and run cognify() in the background.
    # This prevents 'ladybugdb' file lock errors (Error 33) from crashing the agent chain.
    asyncio.create_task(_background_add_and_cognify(text_payload))

    return {"status": "success", "project_id": project_id}

async def _background_add_and_cognify(text_payload: str):
    """Runs Cognee's data insertion and graph enrichment without blocking the agent pipeline."""
    try:
        await cognee.add(text_payload)
        # With MOCK_EMBEDDING=true, cognify consumes all Ollama capacity, blocking agent LLM calls.
        if os.getenv("MOCK_EMBEDDING", "false").lower() not in ("true", "1", "yes"):
            await cognee.cognify()
    except Exception as e:
        print(f"[background_cognify] Non-fatal error: {e}")

async def query_memory(query: str):
    """
    Search the hybrid graph/vector memory for relevant context.
    Falls back to an empty result if Cognee search is unavailable.
    """
    try:
        results = await cognee.search(query)
    except Exception:
        results = []

    # Extract project_id from query like "node_type project_id:xxx"
    parts = query.split()
    if len(parts) >= 2:
        node_type = parts[0]
        project_part = parts[1].split(':')
        if len(project_part) == 2:
            project_id = project_part[1]
            human_name = node_type.replace("_node", "").replace("_", " ").title()
            await publish_timeline_event(project_id, "recall", node_type, f"Agent retrieved {human_name} context from memory.")

    return results
