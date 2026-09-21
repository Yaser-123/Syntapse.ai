import litellm
import asyncio
import json
from backend.memory_layer import add_to_graph
from backend.events import publish_agent_progress

class IdeationAgent:
    """
    Trigger: User Prompt
    Action: Expands prompt into a comprehensive product vision.
    Output: [Ideation] node
    """
    AGENT_NAME = "Ideation"
    EST_SECONDS = 30

    def __init__(self, model="ollama/qwen2.5-coder:3b"):
        self.model = model

    async def run(self, project_id: str, raw_prompt: str):
        await publish_agent_progress(project_id, self.AGENT_NAME, 5, "Initializing Ideation Agent…")

        system_prompt = (
            "You are the Ideation Agent. Expand the user prompt into a rich product vision. "
            "Return ONLY valid JSON with these exact keys: "
            "'core_concept' (string), "
            "'problem_statement' (string), "
            "'unique_value_proposition' (string), "
            "'target_audience' (array of objects with 'name' and 'description'), "
            "'key_features' (array of objects with 'feature_name' and 'description'). "
            "No extra text. Pure JSON only."
        )

        await publish_agent_progress(project_id, self.AGENT_NAME, 20, "Calling LLM to expand product vision…")

        # Run LLM in executor to avoid blocking event loop
        loop = asyncio.get_event_loop()
        try:
            response = await loop.run_in_executor(None, lambda: litellm.completion(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": raw_prompt}
                ],
                response_format={"type": "json_object"},
                timeout=600
            ))
            await publish_agent_progress(project_id, self.AGENT_NAME, 70, "Parsing vision and committing to memory…")
        except Exception as e:
            await publish_agent_progress(project_id, self.AGENT_NAME, 100, f"Error expanding vision: {str(e)}", status="error")
            raise e

        raw = response.choices[0].message.content
        try:
            data = json.loads(raw)
        except Exception:
            data = {"core_concept": raw, "error": "parse_failed"}

        await publish_agent_progress(project_id, self.AGENT_NAME, 100, "Ideation complete. Vision committed to memory.", status="complete")
        await asyncio.sleep(0.5)
        await add_to_graph(project_id, {"type": "ideation_node", "data": data})
        return data