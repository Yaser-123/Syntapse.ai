from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn
import asyncio
from contextlib import asynccontextmanager
from backend.agents.daemon import start_daemons
import json
import redis.asyncio as redis
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from backend.events import REDIS_URL, GRAPH_MUTATED_TOPIC, TIMELINE_EVENT_TOPIC, AGENT_PROGRESS_TOPIC
from backend.agents.ideation import IdeationAgent
from backend.memory_layer import add_to_graph
from backend.routers.module_eval import router as module_eval_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the agent daemons in the background when server starts
    daemon_task = asyncio.create_task(start_daemons())
    yield
    daemon_task.cancel()

app = FastAPI(title="Syntapse Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(module_eval_router)

class PromptRequest(BaseModel):
    prompt: str

class InjectRequest(BaseModel):
    node_type: str
    data: dict

@app.post("/projects/{project_id}/prompt")
async def receive_prompt(project_id: str, request: PromptRequest):
    ideation = IdeationAgent()
    async def run_and_log():
        try:
            print(f"Starting Ideation for {project_id}...")
            await ideation.run(project_id, request.prompt)
            print(f"Ideation finished for {project_id}")
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Ideation failed: {e}")
            
    asyncio.create_task(run_and_log())
    return {"status": "accepted"}

@app.post("/projects/{project_id}/inject")
async def inject_memory(project_id: str, request: InjectRequest):
    await add_to_graph(project_id, {"type": request.node_type, "data": request.data})
    return {"status": "injected"}

@app.get("/")
async def root():
    return {"message": "Welcome to Syntapse Backend"}

@app.websocket("/ws/projects/{project_id}/graph-stream")
async def graph_stream(websocket: WebSocket, project_id: str):
    """
    Streams graph mutations, timeline events, and agent progress to the Next.js frontend.
    """
    await websocket.accept()
    redis_client = redis.from_url(REDIS_URL)
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(GRAPH_MUTATED_TOPIC, TIMELINE_EVENT_TOPIC, AGENT_PROGRESS_TOPIC)
    
    try:
        async for message in pubsub.listen():
            if message['type'] == 'message':
                data = json.loads(message['data'].decode('utf-8'))
                channel = message['channel'].decode('utf-8')
                
                if data.get("project_id") == project_id:
                    if channel == GRAPH_MUTATED_TOPIC:
                        await websocket.send_json({"type": "graph_mutation", "payload": data})
                    elif channel == TIMELINE_EVENT_TOPIC:
                        await websocket.send_json({"type": "timeline_event", "payload": data})
                    elif channel == AGENT_PROGRESS_TOPIC:
                        await websocket.send_json({"type": "agent_progress", "payload": data})
    except WebSocketDisconnect:
        print(f"UI Disconnected from stream for {project_id}")
    finally:
        await pubsub.unsubscribe(GRAPH_MUTATED_TOPIC, TIMELINE_EVENT_TOPIC, AGENT_PROGRESS_TOPIC)
        await redis_client.close()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
