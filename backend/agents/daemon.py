import asyncio
from backend.events import subscribe_to_graph_mutations
from backend.agents.prd import PRDAgent
from backend.agents.architecture import ArchitectureAgent
from backend.agents.tech_stack import TechStackAgent
from backend.agents.implementation import ImplementationStrategyAgent

# Track which projects have agents running to avoid duplicate chains
_running_projects: set = set()

async def agent_evaluator(event_data: dict):
    """
    Sequential Agent Chain.
    When the graph mutates, determine which node just appeared
    and trigger ONLY the next agent in the pipeline.
    This ensures one-at-a-time, step-by-step execution with visible results.
    """
    project_id = event_data.get("project_id")
    node_type = event_data.get("node_type", "")

    print(f"Graph mutated [{project_id}]: {node_type}")

    # Sequential trigger map: what appeared → what runs next
    chain_key = f"{project_id}:{node_type}"
    if chain_key in _running_projects:
        print(f"Agent for {chain_key} already running, skipping.")
        return
    _running_projects.add(chain_key)

    try:
        if node_type == "ideation_node":
            print(f"[{project_id}] Ideation complete → triggering PRD Agent")
            await PRDAgent().run(project_id)

        elif node_type == "prd_node":
            print(f"[{project_id}] PRD complete → triggering Architecture Agent")
            await ArchitectureAgent().run(project_id)

        elif node_type == "architecture_node":
            print(f"[{project_id}] Architecture complete → triggering Tech Stack Agent")
            await TechStackAgent().run(project_id)

        elif node_type == "tech_stack_node":
            print(f"[{project_id}] Tech Stack complete → triggering Implementation Agent")
            await ImplementationStrategyAgent().run(project_id)

        elif node_type == "implementation_strategy_node":
            print(f"[{project_id}] All 5 agents complete! 🎉")

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[{project_id}] Agent error after {node_type}: {e}")
    finally:
        _running_projects.discard(chain_key)

async def start_daemons():
    print("Starting Autonomous Agent Daemons...")
    await subscribe_to_graph_mutations(agent_evaluator)