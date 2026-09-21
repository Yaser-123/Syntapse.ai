import redis.asyncio as redis
import json
import asyncio

REDIS_URL = "redis://localhost:6379"
GRAPH_MUTATED_TOPIC = "graph_mutated"
TIMELINE_EVENT_TOPIC = "timeline_event"
AGENT_PROGRESS_TOPIC = "agent_progress"

redis_client = redis.from_url(REDIS_URL)

async def publish_graph_mutation(project_id: str, node_type: str, data: dict):
    """
    Publishes a mutation event whenever the Cognee graph state changes.
    """
    payload = {
        "project_id": project_id,
        "node_type": node_type,
        "data": data
    }
    await redis_client.publish(GRAPH_MUTATED_TOPIC, json.dumps(payload))

async def publish_timeline_event(project_id: str, action: str, node_type: str, message: str):
    """
    Publishes a memory lifecycle event (remember, recall, improve, forget).
    """
    payload = {
        "project_id": project_id,
        "action": action,
        "node_type": node_type,
        "message": message,
        "timestamp": asyncio.get_event_loop().time() * 1000
    }
    await redis_client.publish(TIMELINE_EVENT_TOPIC, json.dumps(payload))

async def publish_agent_progress(project_id: str, agent_name: str, pct: int, message: str, status: str = "running"):
    """
    Publishes agent execution progress: 0–100%, with a status message.
    status: 'running' | 'complete' | 'error'
    """
    payload = {
        "project_id": project_id,
        "agent_name": agent_name,
        "pct": pct,
        "message": message,
        "status": status,
        "timestamp": asyncio.get_event_loop().time() * 1000
    }
    await redis_client.publish(AGENT_PROGRESS_TOPIC, json.dumps(payload))

async def subscribe_to_graph_mutations(callback):
    """
    Listens for graph mutations and triggers the provided callback.
    """
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(GRAPH_MUTATED_TOPIC)
    
    async for message in pubsub.listen():
        if message['type'] == 'message':
            data = json.loads(message['data'].decode('utf-8'))
            # Trigger the callback asynchronously (fire and forget)
            asyncio.create_task(callback(data))
