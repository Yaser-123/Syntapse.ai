"use client";
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';

export type TimelineEvent = {
  id: string;
  action: 'remember' | 'recall' | 'improve' | 'forget';
  node_type: string;
  message: string;
  timestamp: number;
};

export default function MemoryTimeline({ events, activeNodeId, onEventClick }: { events: TimelineEvent[], activeNodeId: string | null, onEventClick: (nodeType: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Bidirectional Sync: Auto-scroll timeline to active node
  useEffect(() => {
    if (activeNodeId) {
       const activeEl = document.getElementById(`event-${activeNodeId}`);
       if (activeEl) {
           activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
       }
    } else {
       eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeNodeId, events.length]);

  const getIcon = (action: string) => {
    switch (action) {
      case 'remember': return <div className="w-3 h-3 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.9)]" />;
      case 'recall': return <div className="w-3 h-3 rounded-full border-2 border-purple-400 shadow-[0_0_10px_rgba(167,139,250,0.6)]" />;
      case 'improve': return <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,1)]" />;
      case 'forget': return <div className="w-3 h-1 rounded-full bg-gray-500 opacity-60" />;
      default: return <div className="w-2 h-2 rounded-full bg-white/50" />;
    }
  };

  if (events.length === 0) return null;

  return (
    <div className="absolute top-0 left-0 w-80 h-full z-40 bg-gradient-to-r from-black/60 to-transparent pointer-events-none">
      <div 
        ref={containerRef}
        className="h-full overflow-y-auto custom-scrollbar p-8 pointer-events-auto pb-32"
      >
        <div className="relative border-l border-white/10 pl-6 space-y-10 mt-12">
          <AnimatePresence initial={false}>
            {events.map((ev) => (
              <motion.div
                key={ev.id}
                id={`event-${ev.node_type}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`relative group cursor-pointer transition-all duration-500 ${activeNodeId === ev.node_type ? 'scale-105 ml-3' : 'hover:ml-2'}`}
                onClick={() => onEventClick(ev.node_type)}
              >
                <div className="absolute -left-[31px] top-1.5 flex items-center justify-center w-6 h-6 bg-black rounded-full">
                  {getIcon(ev.action)}
                </div>
                <div className="mb-2 flex items-center space-x-2">
                  <span className={`text-[10px] uppercase tracking-widest ${activeNodeId === ev.node_type ? 'text-white font-bold' : 'text-white/40 group-hover:text-white/70'}`}>
                    {ev.action}
                  </span>
                  <span className="text-[10px] text-white/20">
                    {new Date(ev.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                  </span>
                </div>
                <p className={`text-sm font-light leading-relaxed ${activeNodeId === ev.node_type ? 'text-white drop-shadow-lg' : 'text-white/50 group-hover:text-white/90'}`}>
                  {ev.message}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={eventsEndRef} className="h-20" />
        </div>
      </div>
    </div>
  );
}
