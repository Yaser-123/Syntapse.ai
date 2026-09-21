import litellm
import asyncio
import json
from backend.memory_layer import query_memory, add_to_graph
from backend.events import publish_agent_progress

class ImplementationStrategyAgent:
    """
    Trigger: TechStack node without ImplementationStrategy node
    Action: Creates modular prompt execution plan and env vars checklist.
    Output: [Implementation_Strategy] node
    """
    AGENT_NAME = "Implementation"
    EST_SECONDS = 60

    def __init__(self, model="ollama/qwen2.5-coder:3b"):
        self.model = model

    async def run(self, project_id: str):
        await publish_agent_progress(project_id, self.AGENT_NAME, 5, "Implementation Agent awakened. Recalling Tech Stack from memory…")

        memory_results = await query_memory(f"tech_stack_node project_id:{project_id}")
        context = str(memory_results)

        await publish_agent_progress(project_id, self.AGENT_NAME, 20, "Tech Stack retrieved. Generating modular execution plan…")

        system_prompt = (
            "You are the Implementation Strategy Agent. Based on the Tech Stack, create a complete modular execution plan. "
            "Return ONLY valid JSON with these exact keys: "
            "'module_prompts' (array of objects with: 'module_number' (int), 'title' (string), 'goal' (string), "
            "'prompt_template' (string), 'expected_output' (string)). Create 5-8 sequential modules covering the full build. "
            "CRITICAL: The 'prompt_template' MUST NOT be instructions for a human. It MUST be a highly detailed, "
            "sophisticated prompt meant to be copy-pasted into an advanced AI Coding Assistant (like Cursor or Antigravity). "
            "It must tell the AI exactly which files to create, what code/logic to write, how to structure the components, "
            "and what libraries to use. Start prompts with 'Act as an expert developer...' or 'Write the code for...'. "
            "'mcp_tools_required' (array of objects with 'tool_name', 'purpose', 'setup_command'). "
            "'env_vars_checklist' (array of objects with 'var_name', 'description', 'how_to_get'). "
            "'file_structure' (object with 'root_files' as array of strings, 'directories' as array of strings). "
            "Use placeholders like [YOUR_API_KEY] in prompt_template fields. "
            "No extra text. Pure JSON only."
        )

        await publish_agent_progress(project_id, self.AGENT_NAME, 40, "Composing module-wise prompt chain…")

        loop = asyncio.get_event_loop()
        try:
            response = await loop.run_in_executor(None, lambda: litellm.completion(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Tech Stack Context: {context}"}
                ],
                response_format={"type": "json_object"},
                timeout=600
            ))
            await publish_agent_progress(project_id, self.AGENT_NAME, 75, "Execution plan mapped. Finalizing strategy in memory…")
        except Exception as e:
            await publish_agent_progress(project_id, self.AGENT_NAME, 100, f"Error mapping Implementation Strategy: {str(e)}", status="error")
            raise e

        raw = response.choices[0].message.content
        try:
            data = json.loads(raw)
        except Exception:
            data = {"module_prompts": [], "error": "parse_failed", "raw": raw}

        await publish_agent_progress(project_id, self.AGENT_NAME, 100, "Strategy complete. Execution blueprints committed.", status="complete")
        await asyncio.sleep(0.5)
        await add_to_graph(project_id, {"type": "implementation_strategy_node", "data": data})
        return data