import litellm
import asyncio
import json
from backend.memory_layer import query_memory, add_to_graph
from backend.events import publish_agent_progress

class TechStackAgent:
    """
    Trigger: Architecture node without TechStack node
    Action: Selects optimal tech stack with full tooling specification.
    Output: [Tech_Stack] node
    """
    AGENT_NAME = "Tech Stack"
    EST_SECONDS = 40

    def __init__(self, model="ollama/qwen2.5-coder:3b"):
        self.model = model

    async def run(self, project_id: str):
        await publish_agent_progress(project_id, self.AGENT_NAME, 5, "Tech Stack Agent awakened. Recalling Architecture from memory…")

        memory_results = await query_memory(f"architecture_node project_id:{project_id}")
        context = str(memory_results)

        await publish_agent_progress(project_id, self.AGENT_NAME, 25, "Architecture retrieved. Selecting optimal tech stack…")

        system_prompt = (
            "You are the Tech Stack Agent. Based on the Architecture, specify the complete technology stack. "
            "Return ONLY valid JSON with these exact keys: "
            "'frameworks' (object with 'frontend', 'backend', 'mobile' as string fields), "
            "'databases' (array of objects with 'name', 'type', 'purpose'), "
            "'mcps_required' (array of objects with 'mcp_name', 'purpose', 'connection_details'), "
            "'coding_tools' (object with 'ide', 'version_control', 'ci_cd', 'package_manager' as string fields), "
            "'external_apis' (array of objects with 'service', 'purpose', 'env_var_name', 'how_to_get'). "
            "'infrastructure' (object with 'hosting', 'storage', 'cdn', 'monitoring' as string fields). "
            "No extra text. Pure JSON only."
        )

        loop = asyncio.get_event_loop()
        try:
            response = await loop.run_in_executor(None, lambda: litellm.completion(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Architecture Context: {context}"}
                ],
                response_format={"type": "json_object"},
                timeout=600
            ))
            await publish_agent_progress(project_id, self.AGENT_NAME, 75, "Tech stack selected. Writing to memory…")
        except Exception as e:
            await publish_agent_progress(project_id, self.AGENT_NAME, 100, f"Error selecting Tech Stack: {str(e)}", status="error")
            raise e

        raw = response.choices[0].message.content
        try:
            data = json.loads(raw)
        except Exception:
            data = {"frameworks": {}, "error": "parse_failed", "raw": raw}

        await publish_agent_progress(project_id, self.AGENT_NAME, 100, "Tech Stack complete. Blueprint committed to memory.", status="complete")
        await asyncio.sleep(0.5)
        await add_to_graph(project_id, {"type": "tech_stack_node", "data": data})
        return data