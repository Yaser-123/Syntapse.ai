import { supabase } from './supabase';

export type ModuleStatus = 'pending' | 'evaluating' | 'complete' | 'needs_fix';

export interface FixEntry {
  fix_prompt: string;
  user_output: string;
  feedback: string;
  resolved: boolean;
}

export interface ModuleProgress {
  status: ModuleStatus;
  user_output: string;
  feedback: string;
  fixes: FixEntry[]; // targeted fix attempts
}

export type ProgressMap = Record<string, ModuleProgress>; // keyed by module_number string

// ─── Load from Supabase ──────────────────────────────────────────────────────
export async function loadModuleProgress(podId: string): Promise<ProgressMap> {
  const { data } = await supabase
    .from('pod_module_progress')
    .select('progress')
    .eq('pod_id', podId)
    .maybeSingle();
  return (data?.progress as ProgressMap) ?? {};
}

// ─── Save to Supabase ────────────────────────────────────────────────────────
export async function saveModuleProgress(podId: string, progress: ProgressMap): Promise<void> {
  await supabase
    .from('pod_module_progress')
    .upsert({ pod_id: podId, progress, updated_at: new Date().toISOString() }, { onConflict: 'pod_id' });
}

// ─── Call backend evaluator ──────────────────────────────────────────────────
export async function evaluateModuleOutput(
  projectId: string,
  mod: { module_number: number; title: string; goal: string; prompt_template: string },
  userOutput: string,
  backendUrl: string
): Promise<{ passed: boolean; feedback: string; fix_prompt: string | null }> {
  const res = await fetch(`${backendUrl}/projects/${projectId}/modules/${mod.module_number}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      module_number: mod.module_number,
      title: mod.title,
      goal: mod.goal,
      prompt_template: mod.prompt_template,
      user_output: userOutput,
    }),
  });
  if (!res.ok) throw new Error(`Evaluation failed: ${res.statusText}`);
  return res.json();
}
