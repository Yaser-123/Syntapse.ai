"use client";
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ExportPanelProps {
  graphData: { nodes: any[]; links: any[] };
  projectId: string | null;
}

const REQUIRED_NODES = ['ideation_node', 'prd_node', 'architecture_node', 'tech_stack_node', 'implementation_strategy_node'];

function flattenData(obj: any, depth = 0): string {
  if (depth > 3) return String(obj);
  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object' || obj === null) return String(obj);
  if (Array.isArray(obj)) return obj.map(item => flattenData(item, depth + 1)).join('\n');
  return Object.entries(obj).map(([k, v]) => `${k}: ${flattenData(v, depth + 1)}`).join('\n');
}

export default function ExportPanel({ graphData, projectId }: ExportPanelProps) {
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(false);

  const nodeIds = graphData.nodes.map(n => n.id);
  const isComplete = REQUIRED_NODES.every(n => nodeIds.includes(n));

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      // Dynamically import jsPDF to keep bundle small
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 18;
      const contentW = pageW - margin * 2;
      let y = margin;

      const addPage = () => { 
        doc.addPage(); 
        doc.setFillColor(0, 0, 0);
        doc.rect(0, 0, pageW, pageH, 'F');
        y = margin; 
      };

      const checkY = (needed: number) => { if (y + needed > pageH - margin) addPage(); };

      // Title
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, pageW, pageH, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(26);
      doc.setFont('helvetica', 'bold');
      doc.text('SYNTAPSE', margin, y + 10);
      y += 16;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(160, 160, 160);
      doc.text('AI-Generated Execution Plan', margin, y);
      y += 6;
      doc.text(`Project ID: ${projectId || 'demo'}`, margin, y);
      y += 6;
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
      y += 14;

      // Divider
      doc.setDrawColor(60, 60, 60);
      doc.line(margin, y, pageW - margin, y);
      y += 10;

      const agentLabels: Record<string, string> = {
        ideation_node: 'PRODUCT VISION',
        prd_node: 'PRODUCT REQUIREMENTS',
        architecture_node: 'SYSTEM DESIGN',
        tech_stack_node: 'ENGINEERING STACK',
        implementation_strategy_node: 'BUILD STRATEGY',
      };

      for (const nodeId of REQUIRED_NODES) {
        const node = graphData.nodes.find(n => n.id === nodeId);
        if (!node) continue;

        checkY(20);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(180, 180, 255);
        doc.text(agentLabels[nodeId] || nodeId.toUpperCase(), margin, y);
        y += 8;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(200, 200, 200);

        // Special rendering for implementation module_prompts
        const data = node.data?.data || node.data || {};
        
        if (nodeId === 'implementation_strategy_node' && Array.isArray(data.module_prompts)) {
          for (const mod of data.module_prompts) {
            checkY(30);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 200, 100);
            doc.text(`Module ${mod.module_number}: ${mod.title}`, margin, y);
            y += 5;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(180, 180, 180);
            const goalLines = doc.splitTextToSize(`Goal: ${mod.goal}`, contentW);
            doc.text(goalLines, margin, y);
            y += goalLines.length * 4 + 3;
            doc.setTextColor(140, 200, 140);
            doc.setFont('courier', 'normal');
            const promptLines = doc.splitTextToSize(mod.prompt_template || '', contentW);
            checkY(promptLines.length * 4 + 5);
            doc.text(promptLines, margin, y);
            y += promptLines.length * 4 + 8;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(200, 200, 200);
          }
          // Env vars checklist
          if (Array.isArray(data.env_vars_checklist) && data.env_vars_checklist.length) {
            checkY(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(180, 180, 255);
            doc.text('ENV VARS CHECKLIST', margin, y);
            y += 6;
            doc.setFont('courier', 'normal');
            doc.setTextColor(200, 200, 200);
            for (const ev of data.env_vars_checklist) {
              checkY(8);
              const line = `☐  ${ev.var_name}  —  ${ev.description}`;
              const lines = doc.splitTextToSize(line, contentW);
              doc.text(lines, margin, y);
              y += lines.length * 4 + 2;
            }
          }
        } else {
          const text = flattenData(data);
          const lines = doc.splitTextToSize(text, contentW);
          for (let i = 0; i < lines.length; i += 40) {
            const chunk = lines.slice(i, i + 40);
            checkY(chunk.length * 4 + 4);
            doc.text(chunk, margin, y);
            y += chunk.length * 4;
          }
        }

        y += 10;
        if (y < pageH - margin - 10) {
          doc.setDrawColor(40, 40, 40);
          doc.line(margin, y, pageW - margin, y);
          y += 8;
        }
      }

      doc.save(`syntapse-execution-plan-${Date.now()}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  if (!isComplete) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="fixed top-6 right-6 z-50 flex flex-col items-end gap-2"
      >
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleExportPDF}
          disabled={exporting}
          className="flex items-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-semibold rounded-xl shadow-[0_0_30px_rgba(255,255,255,0.25)] hover:shadow-[0_0_40px_rgba(255,255,255,0.45)] transition-all disabled:opacity-50"
        >
          {exporting ? (
            <>
              <span className="animate-spin">⏳</span> Generating PDF…
            </>
          ) : (
            <>
              <span>📄</span> Export Plan
            </>
          )}
        </motion.button>
        <p className="text-white/30 text-xs pr-1">All 5 agents complete</p>
      </motion.div>
    </AnimatePresence>
  );
}
