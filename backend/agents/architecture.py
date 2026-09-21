import litellm
import asyncio
import json
from backend.memory_layer import query_memory, add_to_graph
from backend.events import publish_agent_progress

class ArchitectureAgent:
    """
    Trigger: PRD node without Architecture node
    Action: Designs system architecture from PRD.
    Output: [Architecture] node
    """
    AGENT_NAME = "Architecture"
    EST_SECONDS = 45

    def __init__(self, model="ollama/qwen2.5-coder:3b"):
        self.model = model

    async def run(self, project_id: str):
        await publish_agent_progress(project_id, self.AGENT_NAME, 5, "Architecture Agent awakened. Recalling PRD from memory…")

        memory_results = await query_memory(f"prd_node project_id:{project_id}")
        context = str(memory_results)

        await publish_agent_progress(project_id, self.AGENT_NAME, 25, "PRD retrieved. Designing system architecture…")

        system_prompt = (
            "You are the Architecture Agent. Based on the PRD, design the complete system architecture. "
            "Return ONLY valid JSON with these exact keys: "
            "'system_components' (array of objects with 'name', 'type', 'responsibility'), "
            "'data_models' (array of objects with 'entity', 'fields' as array of strings), "
            "'api_endpoints' (array of objects with 'method', 'path', 'description'), "
            "'external_services_required' (array of objects with 'service_name', 'purpose', 'api_key_env_var'). "
            "No extra text. Pure JSON only."
        )

        loop = asyncio.get_event_loop()
        try:
            response = await loop.run_in_executor(None, lambda: litellm.completion(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"PRD Context: {context}"}
                ],
                response_format={"type": "json_object"},
                timeout=600
            ))
            await publish_agent_progress(project_id, self.AGENT_NAME, 75, "Architecture designed. Writing to memory…")
        except Exception as e:
            await publish_agent_progress(project_id, self.AGENT_NAME, 100, f"Error designing Architecture: {str(e)}", status="error")
            raise e

        raw = response.choices[0].message.content
        try:
            data = json.loads(raw)
        except Exception:
            data = {"system_components": [], "error": "parse_failed", "raw": raw}

        await publish_agent_progress(project_id, self.AGENT_NAME, 100, "Architecture complete. Blueprint committed to memory.", status="complete")
        await asyncio.sleep(0.5)
        await add_to_graph(project_id, {"type": "architecture_node", "data": data})
        return data