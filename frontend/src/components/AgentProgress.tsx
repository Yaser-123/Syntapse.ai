"use client";
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface AgentProgressProps {
  agent_name: string;
  pct: number;
  message: string;
  status: 'running' | 'complete' | 'error';
}

const AGENT_ORDER = ['Ideation', 'PRD', 'Architecture', 'Tech Stack', 'Implementation'];
const AGENT_ICONS: Record<string, string> = {
  'Ideation': '💡',
  'PRD': '📋',
  'Architecture': '🏗️',
  'Tech Stack': '⚙️',
  'Implementation': '🚀',
};

export default function AgentProgress({ progress }: { progress: AgentProgressProps | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (progress) {
      setVisible(true);
      if (progress.status === 'complete') {
        const t = setTimeout(() => setVisible(false), 2500);
        return () => clearTimeout(t);
      }
    }
  }, [progress]);

  if (!progress) return null;

  const agentIdx = AGENT_ORDER.indexOf(progress.agent_name);
  const totalAgents = AGENT_ORDER.length;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={progress.agent_name + progress.pct}
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.96 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-[480px] max-w-[90vw]"
        >
          <div className="bg-black/70 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-2xl">
            {/* Agent pipeline dots */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {AGENT_ORDER.map((name, idx) => (
                <div key={name} className="flex items-center gap-2">
                  <div className={`
                    w-2 h-2 rounded-full transition-all duration-500
                    ${idx < agentIdx ? 'bg-green-400' : idx === agentIdx ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)] animate-pulse' : 'bg-white/15'}
                  `} />
                  {idx < totalAgents - 1 && (
                    <div className={`w-6 h-px transition-all duration-500 ${idx < agentIdx ? 'bg-green-400/60' : 'bg-white/10'}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Agent name + icon */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{AGENT_ICONS[progress.agent_name] || '🤖'}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium text-sm tracking-wide">{progress.agent_name} Agent</span>
                  {progress.status === 'running' && (
                    <span className="flex gap-0.5">
                      {[0, 0.15, 0.3].map((delay, i) => (
                        <motion.span
                          key={i}
                          className="w-1 h-1 bg-blue-400 rounded-full"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.7, repeat: Infinity, delay }}
                        />
                      ))}
                    </span>
                  )}
                  {progress.status === 'complete' && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-green-400 text-xs font-semibold"
                    >
                      ✓ Done
                    </motion.span>
                  )}
                </div>
                <p className="text-white/40 text-xs mt-0.5">
                  Step {agentIdx + 1} of {totalAgents}
                </p>
              </div>
              <span className="ml-auto text-white/60 text-sm font-mono">{progress.pct}%</span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mb-3">
              <motion.div
                className={`h-full rounded-full ${progress.status === 'complete' ? 'bg-green-400' : 'bg-gradient-to-r from-blue-500 to-violet-500'}`}
                initial={{ width: 0 }}
                animate={{ width: `${progress.pct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>

            {/* Status message */}
            <p className="text-white/50 text-xs leading-relaxed">{progress.message}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
