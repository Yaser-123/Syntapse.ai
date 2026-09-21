"use client";
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import {
  loadModuleProgress,
  saveModuleProgress,
  evaluateModuleOutput,
  type ModuleProgress,
  type ProgressMap,
} from '@/lib/moduleTracker';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

const NODE_LABELS: Record<string, string> = {
  ideation_node: 'Product Vision',
  prd_node: 'Product Requirements',
  architecture_node: 'System Design',
  tech_stack_node: 'Engineering Stack',
  implementation_strategy_node: 'Build Strategy',
};

function RenderValue({ label, value, depth = 0, editMode, onChange }: {
  label?: string; value: any; depth?: number; editMode: boolean; onChange: (v: any) => void;
}) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') {
    return (
      <div className="group">
        {label && <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">{label.replace(/_/g, ' ')}</p>}
        {editMode ? (
          <textarea
            className="w-full bg-white/5 border border-white/20 rounded-lg p-2 text-sm text-white/90 resize-none focus:outline-none focus:border-blue-400/50 transition-colors min-h-[40px]"
            defaultValue={String(value)}
            rows={String(value).length > 80 ? 4 : 2}
            onChange={e => onChange(e.target.value)}
          />
        ) : (
          <p className="text-sm text-white/80 leading-relaxed">{String(value)}</p>
        )}
      </div>
    );
  }
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] !== 'object') {
      return (
        <div>
          {label && <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">{label.replace(/_/g, ' ')}</p>}
          <ul className="space-y-1">
            {value.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-white/20 mt-0.5 text-xs">•</span>
                {editMode ? (
                  <input
                    className="flex-1 bg-white/5 border border-white/20 rounded px-2 py-1 text-sm text-white/80 focus:outline-none focus:border-blue-400/50"
                    defaultValue={String(item)}
                    onChange={e => { const u=[...value]; u[idx]=e.target.value; onChange(u); }}
                  />
                ) : (
                  <span className="text-sm text-white/70">{String(item)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    return (
      <div>
        {label && <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">{label.replace(/_/g, ' ')}</p>}
        <div className="space-y-3">
          {value.map((item, idx) => (
            <div key={idx} className="bg-white/3 border border-white/8 rounded-xl p-3 space-y-2">
              {Object.entries(item).map(([k, v]) => (
                <RenderValue key={k} label={k} value={v} depth={depth+1} editMode={editMode}
                  onChange={nv => { const u=[...value]; u[idx]={...u[idx],[k]:nv}; onChange(u); }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      {label && <p className="text-[10px] uppercase tracking-widest text-white/30 mb-2">{label.replace(/_/g, ' ')}</p>}
      <div className="space-y-3">
        {Object.entries(value).map(([k, v]) => (
          <RenderValue key={k} label={k} value={v} depth={depth+1} editMode={editMode}
            onChange={nv => onChange({...value,[k]:nv})} />
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ModuleProgress['status'] }) {
  const styles: Record<string,string> = {
    pending:    'bg-white/10 text-white/40',
    evaluating: 'bg-blue-500/20 text-blue-300',
    complete:   'bg-green-500/20 text-green-400',
    needs_fix:  'bg-orange-500/20 text-orange-400',
  };
  const labels: Record<string,string> = {
    pending:    'Pending',
    evaluating: '⏳ Evaluating…',
    complete:   '✓ Complete',
    needs_fix:  '↩ Needs Fix',
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-all ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function ModuleProgressBar({ progressMap, total }: { progressMap: ProgressMap; total: number }) {
  const completed = Object.values(progressMap).filter(p => p.status === 'complete').length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-white/30">Build Progress</p>
        <span className="text-[10px] font-mono text-white/50">{completed} / {total} modules · {pct}%</span>
      </div>
      <div className="relative h-1.5 bg-white/8 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-green-400 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function ModulePromptCard({ mod, editMode, onChange, progress, onEvaluate, onUpdateOutput }: {
  mod: any; editMode: boolean; onChange: (v: any) => void;
  progress: ModuleProgress; onEvaluate: () => void; onUpdateOutput: (t: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copiedFix, setCopiedFix] = useState<number|null>(null);
  const isComplete = progress.status === 'complete';

  return (
    <div className={`rounded-xl border transition-all duration-500 overflow-hidden ${
      isComplete ? 'bg-green-950/20 border-green-500/20'
      : progress.status === 'needs_fix' ? 'bg-orange-950/20 border-orange-500/20'
      : 'bg-white/3 border-white/8'
    }`}>
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded-full text-white/60">Module {mod.module_number}</span>
        <span className="text-sm font-medium text-white/90 flex-1">{mod.title}</span>
        <StatusBadge status={progress.status} />
      </div>
      <div className="px-4 pb-4 space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Goal</p>
          <p className="text-xs text-white/60 leading-relaxed">{mod.goal}</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] uppercase tracking-widest text-white/30">Prompt Template</p>
            <button onClick={() => { navigator.clipboard.writeText(mod.prompt_template||''); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
              className="text-[10px] text-white/40 hover:text-white/80 transition-colors">
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          {editMode ? (
            <textarea className="w-full bg-black/40 border border-green-400/20 rounded-lg p-3 text-xs font-mono text-green-300/80 resize-none focus:outline-none focus:border-green-400/40 min-h-[80px]"
              defaultValue={mod.prompt_template||''} onChange={e=>onChange({...mod,prompt_template:e.target.value})} />
          ) : (
            <div className="bg-black/40 border border-green-400/10 rounded-lg p-3 text-xs font-mono text-green-300/70 leading-relaxed whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
              {mod.prompt_template}
            </div>
          )}
        </div>

        {progress.fixes && progress.fixes.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-orange-400/60">Targeted Fix Prompts</p>
            {progress.fixes.map((fix, idx) => (
              <div key={idx} className={`rounded-lg border p-3 space-y-2 ${fix.resolved ? 'border-green-500/20 bg-green-950/10' : 'border-orange-500/20 bg-orange-950/10'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-orange-400/80">Fix {idx+1} {fix.resolved ? '✓' : ''}</span>
                  <button onClick={() => { navigator.clipboard.writeText(fix.fix_prompt); setCopiedFix(idx); setTimeout(()=>setCopiedFix(null),2000); }}
                    className="text-[10px] text-white/40 hover:text-white/70 transition-colors">
                    {copiedFix===idx ? '✓ Copied' : 'Copy Fix'}
                  </button>
                </div>
                <div className="bg-black/40 border border-orange-400/10 rounded p-2 text-xs font-mono text-orange-200/70 leading-relaxed whitespace-pre-wrap break-words">
                  {fix.fix_prompt}
                </div>
                {fix.feedback && <p className="text-[10px] text-white/40 italic">{fix.feedback}</p>}
              </div>
            ))}
          </div>
        )}

        {!isComplete && (
          <div className="space-y-2 border-t border-white/5 pt-3">
            <p className="text-[10px] uppercase tracking-widest text-white/30">Paste AI Output / Walkthrough</p>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-white/80 placeholder-white/20 resize-none focus:outline-none focus:border-blue-400/30 transition-colors min-h-[70px]"
              placeholder="Paste your coding AI output or walkthrough here…"
              value={progress.user_output}
              onChange={e => onUpdateOutput(e.target.value)}
            />
            <button
              disabled={progress.status==='evaluating' || !progress.user_output.trim()}
              onClick={onEvaluate}
              className="w-full py-2 text-xs font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30"
            >
              {progress.status==='evaluating' ? '⏳ Evaluating with AI…' : '⚡ Evaluate Output'}
            </button>
            {progress.feedback && progress.status==='needs_fix' && (
              <p className="text-[10px] text-orange-300/80 leading-relaxed">{progress.feedback}</p>
            )}
          </div>
        )}
        {isComplete && (
          <div className="border-t border-green-500/10 pt-3">
            <p className="text-[10px] text-green-400/70">✓ {progress.feedback || 'Module output verified and complete.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SpatialCard({ selectedNode, onClose, onInject, podId }: {
  selectedNode: any; onClose: ()=>void; onInject: (data:any)=>void; podId?: string;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState<any>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [progressMap, setProgressMap] = useState<ProgressMap>({});

  useEffect(() => {
    if (selectedNode) {
      const raw = selectedNode.data?.data ?? selectedNode.data ?? {};
      setEditedData(raw);
      setEditMode(false);
      setHasChanges(false);
    }
  }, [selectedNode]);

  useEffect(() => {
    if (podId && selectedNode?.id==='implementation_strategy_node') {
      loadModuleProgress(podId).then(data => {
        // Reset any stuck "evaluating" states back to "pending" when reloading the panel
        let hasStuckStates = false;
        const cleanedData = { ...data };
        for (const key in cleanedData) {
          if (cleanedData[key].status === 'evaluating') {
            cleanedData[key].status = 'pending';
            hasStuckStates = true;
          }
        }
        
        setProgressMap(cleanedData);
        if (hasStuckStates) {
          saveModuleProgress(podId, cleanedData);
        }
      });
    }
  }, [podId, selectedNode?.id]);

  const persistProgress = useCallback(async (updated: ProgressMap) => {
    setProgressMap(updated);
    if (podId) await saveModuleProgress(podId, updated);
  }, [podId]);

  const getModuleProgress = (n: number|string): ModuleProgress =>
    progressMap[String(n)] ?? { status:'pending', user_output:'', feedback:'', fixes:[] };

  const updateOutput = async (n: number|string, text: string) => {
    const key=String(n); const curr=getModuleProgress(n);
    await persistProgress({...progressMap,[key]:{...curr,user_output:text}});
  };

  const handleEvaluate = async (mod: any) => {
    if (!podId) return;
    const key=String(mod.module_number); const curr=getModuleProgress(mod.module_number);
    if (!curr.user_output.trim()) return;
    await persistProgress({...progressMap,[key]:{...curr,status:'evaluating'}});
    try {
      const result = await evaluateModuleOutput(podId, mod, curr.user_output, BACKEND_URL);
      if (result.passed) {
        await persistProgress({...progressMap,[key]:{...curr,status:'complete',feedback:result.feedback}});
      } else {
        const newFix = { fix_prompt:result.fix_prompt||'', user_output:curr.user_output, feedback:result.feedback, resolved:false };
        await persistProgress({...progressMap,[key]:{...curr,status:'needs_fix',feedback:result.feedback,fixes:[...(curr.fixes||[]),newFix],user_output:''}});
      }
    } catch {
      await persistProgress({...progressMap,[key]:{...curr,status:'needs_fix',feedback:'Evaluation failed — check if backend is running.'}});
    }
  };

  if (!selectedNode || editedData===null) return null;
  const label = NODE_LABELS[selectedNode.id] || selectedNode.id;
  const isImplementation = selectedNode.id==='implementation_strategy_node';
  const modulePrompts = isImplementation && Array.isArray(editedData.module_prompts) ? editedData.module_prompts : null;
  const otherData = isImplementation
    ? Object.fromEntries(Object.entries(editedData).filter(([k])=>k!=='module_prompts'))
    : editedData;

  return (
    <AnimatePresence>
      <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
        <motion.div
          initial={{opacity:0,scale:0.93,y:24}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.93,y:24}}
          transition={{type:'spring',damping:26,stiffness:320}}
          className="w-full max-w-xl bg-black/50 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden"
          style={{maxHeight:'82vh'}}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
            <div>
              <h2 className="text-lg font-light tracking-wide text-white/90">🚀 {label}</h2>
              {editMode && <p className="text-xs text-blue-400/80 mt-0.5">Edit mode — modify any field below</p>}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={()=>setEditMode(!editMode)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${editMode?'border-blue-400/50 text-blue-400 bg-blue-400/10':'border-white/15 text-white/40 hover:text-white/70 hover:border-white/30'}`}>
                {editMode?'✎ Editing':'✎ Edit'}
              </button>
              <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none">✕</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar">
            <RenderValue value={otherData} depth={0} editMode={editMode}
              onChange={nv=>{setEditedData(isImplementation?{...editedData,...nv}:nv); setHasChanges(true);}} />
            {modulePrompts && (
              <div className="space-y-4">
                <div className="pt-2 border-t border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-widest text-white/30">
                      Module Prompt Chain ({modulePrompts.length} modules)
                    </p>
                  </div>
                  <ModuleProgressBar progressMap={progressMap} total={modulePrompts.length} />
                </div>
                {modulePrompts.map((mod: any, idx: number) => (
                  <ModulePromptCard key={idx} mod={mod} editMode={editMode}
                    onChange={nv=>{const u=[...modulePrompts];u[idx]=nv;setEditedData({...editedData,module_prompts:u}); setHasChanges(true);}}
                    progress={getModuleProgress(mod.module_number)}
                    onEvaluate={()=>handleEvaluate(mod)}
                    onUpdateOutput={t=>updateOutput(mod.module_number,t)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="px-6 py-5 border-t border-white/8">
            <button onClick={()=>onInject(editedData)}
              disabled={!hasChanges}
              className={`w-full py-3.5 font-semibold rounded-2xl transition-all text-sm ${
                hasChanges
                  ? 'bg-white text-black hover:bg-gray-100 hover:shadow-[0_0_40px_rgba(255,255,255,0.35)] active:scale-[0.98]'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}>
              {editMode?'💉 Inject Edited Memory':'💉 Inject Memory'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
