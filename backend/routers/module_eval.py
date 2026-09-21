import litellm
import asyncio
import json
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class EvaluateRequest(BaseModel):
    module_number: int
    title: str
    goal: str
    prompt_template: str
    user_output: str


class EvaluateResponse(BaseModel):
    passed: bool
    feedback: str
    fix_prompt: str | None = None  # targeted fix prompt — only what's missing


@router.post("/projects/{project_id}/modules/{module_number}/evaluate")
async def evaluate_module_output(
    project_id: str,
    module_number: int,
    request: EvaluateRequest,
) -> EvaluateResponse:
    """
    Uses the AI to judge whether the user's pasted output satisfies the module goal.
    If not, generates a SHORT targeted fix prompt addressing only what's missing — not a full re-do.
    """

    judge_prompt = (
        "You are a strict but fair code review AI. "
        "Your job is to evaluate whether a developer's output meets the goal of a module.\n\n"
        f"MODULE GOAL:\n{request.goal}\n\n"
        f"ORIGINAL PROMPT GIVEN TO THE AI:\n{request.prompt_template}\n\n"
        f"DEVELOPER'S OUTPUT / WALKTHROUGH:\n{request.user_output}\n\n"
        "INSTRUCTIONS:\n"
        "1. Decide if the output satisfies the goal. Output 'passed' as true or false.\n"
        "2. Write a short 'feedback' sentence (1-2 sentences max) explaining your decision.\n"
        "3. If the output did NOT pass, write a 'fix_prompt' — a SHORT, targeted instruction "
        "   (2-5 sentences max) telling the AI coding assistant EXACTLY what is still missing "
        "   and how to fix ONLY that specific gap. Do NOT rewrite the full module. "
        "   Start it with 'You previously completed most of this step, but...'\n"
        "4. If it passed, set fix_prompt to null.\n\n"
        "Respond ONLY with valid JSON: "
        '{"passed": bool, "feedback": "...", "fix_prompt": "..." or null}'
    )

    loop = asyncio.get_event_loop()
    try:
        response = await loop.run_in_executor(
            None,
            lambda: litellm.completion(
                model="ollama/qwen2.5-coder:3b",
                messages=[{"role": "user", "content": judge_prompt}],
                response_format={"type": "json_object"},
                timeout=120,
            ),
        )
        raw = response.choices[0].message.content
        result = json.loads(raw)
        return EvaluateResponse(
            passed=bool(result.get("passed", False)),
            feedback=str(result.get("feedback", "Could not determine.")),
            fix_prompt=result.get("fix_prompt"),
        )
    except Exception as e:
        return EvaluateResponse(
            passed=False,
            feedback=f"Evaluation failed: {str(e)}",
            fix_prompt=None,
        )
