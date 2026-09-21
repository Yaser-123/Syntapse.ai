import litellm
import asyncio
import json
from backend.memory_layer import query_memory, add_to_graph
from backend.events import publish_agent_progress

class PRDAgent:
    """
    Trigger: Ideation node without PRD node
    Action: Formulates comprehensive product requirements from Ideation.
    Output: [PRD] node
    """
    AGENT_NAME = "PRD"
    EST_SECONDS = 40

    def __init__(self, model="ollama/qwen2.5-coder:3b"):
        self.model = model

    async def run(self, project_id: str):
        await publish_agent_progress(project_id, self.AGENT_NAME, 5, "PRD Agent awakened. Recalling Ideation from memory…")

        memory_results = await query_memory(f"ideation_node project_id:{project_id}")
        context = str(memory_results)

        await publish_agent_progress(project_id, self.AGENT_NAME, 25, "Ideation context retrieved. Generating requirements…")

        system_prompt = (
            "You are the PRD Agent. Based on the Ideation phase, formulate strict product requirements. "
            "Return ONLY valid JSON with these exact keys: "
            "'user_stories' (array of objects with 'as_a', 'i_want', 'so_that'), "
            "'acceptance_criteria' (array of strings), "
            "'non_functional_requirements' (object with 'performance', 'security', 'scalability' as string fields), "
            "'out_of_scope' (array of strings — features explicitly excluded from v1). "
            "No extra text. Pure JSON only."
        )

        loop = asyncio.get_event_loop()
        try:
            response = await loop.run_in_executor(None, lambda: litellm.completion(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Ideation Context: {context}"}
                ],
                response_format={"type": "json_object"},
                timeout=600
            ))
            await publish_agent_progress(project_id, self.AGENT_NAME, 75, "Requirements defined. Writing PRD to memory…")
        except Exception as e:
            await publish_agent_progress(project_id, self.AGENT_NAME, 100, f"Error generating PRD: {str(e)}", status="error")
            raise e

        raw = response.choices[0].message.content
        try:
            data = json.loads(raw)
        except Exception:
            data = {"user_stories": [], "error": "parse_failed", "raw": raw}

        await publish_agent_progress(project_id, self.AGENT_NAME, 100, "PRD complete. Requirements committed to memory.", status="complete")
        await asyncio.sleep(0.5) # Give UI time to render 'complete' state before starting next agent
        await add_to_graph(project_id, {"type": "prd_node", "data": data})
        return data