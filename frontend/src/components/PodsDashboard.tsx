"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase, type Pod } from "@/lib/supabase";

const NODE_ICONS: Record<string, string> = {
  ideation_node: "💡",
  prd_node: "📋",
  architecture_node: "🏗️",
  tech_stack_node: "⚙️",
  implementation_strategy_node: "🚀",
};

function PodCard({ pod, onOpen, onDelete }: {
  pod: Pod;
  onOpen: (pod: Pod) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const date = new Date(pod.created_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      whileHover={{ y: -2 }}
      className="group bg-white/[0.03] border border-white/10 rounded-2xl p-5 cursor-pointer hover:border-white/20 hover:bg-white/[0.05] transition-all"
      onClick={() => !confirmDelete && onOpen(pod)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white/90 font-medium text-sm truncate">{pod.title}</h3>
          <p className="text-white/50 text-xs mt-2 line-clamp-3 leading-relaxed">{pod.prompt}</p>
          <p className="text-white/20 text-[10px] mt-3">{date}</p>
        </div>
        <div className="flex-shrink-0">
          {!confirmDelete ? (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all text-xs px-2 py-1 rounded-lg border border-transparent hover:border-red-400/20"
            >
              Delete
            </button>
          ) : (
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onDelete(pod.id)}
                className="text-red-400 text-xs px-2 py-1 rounded-lg border border-red-400/30 hover:bg-red-400/10 transition-all"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-white/30 text-xs px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function PodsDashboard({
  user,
  pods,
  onOpenPod,
  onPodsChange,
  onSignOut,
}: {
  user: { email?: string };
  pods: Pod[];
  onOpenPod: (pod: Pod, prompt: string) => void;
  onPodsChange: () => void;
  onSignOut: () => void;
}) {
  const [showNewPod, setShowNewPod] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreatePod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newPrompt.trim()) return;
    setCreating(true);
    setError(null);

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data, error: err } = await supabase
      .from("pods")
      .insert({ title: newTitle.trim(), prompt: newPrompt.trim(), user_id: authUser.id })
      .select()
      .single();

    setCreating(false);
    if (err) { setError(err.message); return; }
    setShowNewPod(false);
    setNewTitle("");
    setNewPrompt("");
    onPodsChange();
    if (data) onOpenPod(data, data.prompt);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("pods").delete().eq("id", id);
    onPodsChange();
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-auto">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-white/[0.015] blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center backdrop-blur-md border border-white/10 shadow-lg">
                <svg className="w-5 h-5 text-white/90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20"></path>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
              <h1 className="text-2xl font-light tracking-wider text-white/90">Syntapse</h1>
            </div>
            <p className="text-white/25 text-sm ml-9">{user.email}</p>
          </div>
          <button
            onClick={onSignOut}
            className="text-white/30 hover:text-white/60 transition-colors text-sm border border-white/10 hover:border-white/20 px-4 py-2 rounded-xl"
          >
            Sign out
          </button>
        </div>

        {/* Section header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white/50 text-sm uppercase tracking-widest">
            Your Pods <span className="text-white/20 ml-2 normal-case">({pods.length})</span>
          </h2>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowNewPod(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-black text-sm font-semibold rounded-xl hover:bg-gray-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)]"
          >
            <span className="text-base">+</span> New Pod
          </motion.button>
        </div>

        {/* Pods grid */}
        <AnimatePresence mode="popLayout">
          {pods.length === 0 && !showNewPod && (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20"
            >
              <p className="text-white/20 text-4xl mb-4">🌱</p>
              <p className="text-white/30 text-sm">No pods yet. Create your first one.</p>
            </motion.div>
          )}
          <div key="pods-grid" className="grid gap-3">
            {pods.map((pod) => (
              <PodCard
                key={pod.id}
                pod={pod}
                onOpen={(p) => onOpenPod(p, p.prompt)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </AnimatePresence>

        {/* New Pod Modal */}
        <AnimatePresence>
          {showNewPod && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
                onClick={() => setShowNewPod(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 flex items-center justify-center z-50 px-6"
              >
                <form
                  onSubmit={handleCreatePod}
                  className="w-full max-w-lg bg-black/90 border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-white/90 text-lg font-medium mb-6">New Pod</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="text-white/40 text-xs uppercase tracking-widest block mb-2">Pod Name</label>
                      <input
                        autoFocus
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Ride-sharing app for EVs"
                        className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-white/40 text-xs uppercase tracking-widest block mb-2">Initial Prompt</label>
                      <textarea
                        value={newPrompt}
                        onChange={(e) => setNewPrompt(e.target.value)}
                        placeholder="Describe the idea you want the AI swarm to analyze..."
                        rows={4}
                        className="w-full bg-white/5 border border-white/10 text-white placeholder-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-colors resize-none"
                      />
                    </div>
                  </div>

                  {error && <p className="text-red-400/80 text-xs mt-3">{error}</p>}

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowNewPod(false)}
                      className="flex-1 py-3 border border-white/10 text-white/40 rounded-xl text-sm hover:bg-white/5 transition-all"
                    >
                      Cancel
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={creating}
                      className="flex-1 py-3 bg-white text-black font-semibold rounded-xl text-sm hover:bg-gray-100 transition-all disabled:opacity-50"
                    >
                      {creating ? "Launching…" : "Launch Pod →"}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
