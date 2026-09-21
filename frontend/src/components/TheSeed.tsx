"use client";
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TheSeed({ onSubmit }: { onSubmit: (prompt: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setIsSubmitted(true);
    // Add a slight delay for the shatter animation before notifying parent
    setTimeout(() => {
      onSubmit(prompt);
    }, 800);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <AnimatePresence>
        {!isSubmitted ? (
          <motion.form 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0, filter: "blur(10px)" }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            onSubmit={handleSubmit}
            className="w-full max-w-3xl px-6 flex flex-col items-center"
          >
            <input
              type="text"
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Give the swarm a purpose..."
              className="w-full bg-white/5 border border-white/10 text-white placeholder-white/40 rounded-2xl px-8 py-5 text-2xl focus:outline-none focus:ring-2 focus:ring-white/20 backdrop-blur-md shadow-2xl transition-all"
            />
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 1 }}
              className="mt-6 text-white/30 text-sm font-light tracking-wide text-center"
            >
              e.g., "Build a distributed ride-sharing app for electric scooters"
            </motion.p>
          </motion.form>
        ) : (
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.2, 1], opacity: 1, filter: ["blur(10px)", "blur(0px)"] }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="w-8 h-8 bg-white rounded-full shadow-[0_0_40px_10px_rgba(255,255,255,0.7)]"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
