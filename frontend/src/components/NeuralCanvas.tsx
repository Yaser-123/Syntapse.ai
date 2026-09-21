"use client";
import { useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { ForceGraphMethods } from 'react-force-graph-2d';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export default function NeuralCanvas({ graphData, onNodeClick, isBlurred }: { graphData: any, onNodeClick: (node: any) => void, isBlurred: boolean }) {
  const fgRef = useRef<ForceGraphMethods>();

  useEffect(() => {
    if (fgRef.current) {
      // Moderate repulsion so nodes cluster together naturally
      fgRef.current.d3Force('charge')?.strength(-250);
      fgRef.current.d3Force('link')?.distance(100);
    }
    
    if (fgRef.current && graphData.nodes.length > 0 && !isBlurred) {
      // Focus on the newest node seamlessly
      const newestNode = graphData.nodes[graphData.nodes.length - 1];
      fgRef.current.centerAt(newestNode.x, newestNode.y, 1000);
      fgRef.current.zoom(1.8, 1000); // slightly zoomed out for better context
    }
  }, [graphData.nodes.length, isBlurred]);

  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.id || "Node";
    const fontSize = 12 / globalScale;
    ctx.font = `300 ${fontSize}px Inter, sans-serif`;
    
    // Node state styles
    const state = node.memoryState || "remembered"; // thinking, remembered, improved, forgotten
    
    let radius = 8;
    let coreColor = 'rgba(255, 255, 255, 0.9)';
    let haloColor = 'rgba(255, 255, 255, 0)';
    let haloBlur = 0;
    
    if (state === "thinking") {
      radius = 10 + Math.sin(Date.now() / 150) * 2; // Rapid pulsing
      coreColor = 'rgba(100, 200, 255, 0.5)';
      haloColor = 'rgba(100, 200, 255, 0.8)';
      haloBlur = 35;
    } else if (state === "remembered") {
      radius = 8;
      coreColor = 'rgba(200, 200, 200, 0.7)'; // frosted glass look
      haloColor = 'rgba(255, 255, 255, 0.2)';
      haloBlur = 10;
    } else if (state === "improved") {
      radius = 14;
      coreColor = 'rgba(255, 255, 255, 1)'; // blinding white flare
      haloColor = 'rgba(255, 255, 255, 0.9)';
      haloBlur = 50;
    } else if (state === "forgotten") {
      radius = 6;
      coreColor = 'rgba(50, 50, 50, 0.3)'; // ashen
      haloColor = 'transparent';
    }

    // Draw Halo
    if (haloBlur > 0) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
      ctx.fillStyle = haloColor;
      ctx.shadowColor = haloColor;
      ctx.shadowBlur = haloBlur;
      ctx.fill();
      ctx.shadowBlur = 0; // reset
    }

    // Draw Core
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius * 0.6, 0, 2 * Math.PI, false);
    ctx.fillStyle = coreColor;
    ctx.fill();
    
    // Label
    if (state !== "forgotten") {
      const labelMap: Record<string, string> = {
        'ideation_node': 'Product Vision',
        'prd_node': 'Product Requirements',
        'architecture_node': 'System Design',
        'tech_stack_node': 'Engineering Stack',
        'implementation_strategy_node': 'Build Strategy',
        'Raw Prompt': 'Raw Prompt'
      };
      
      const displayLabel = typeof label === 'string' 
        ? (labelMap[label] || label.replace('_node', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
        : label;
        
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = state === "thinking" ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.95)';
      ctx.fillText(displayLabel, node.x, node.y + 24);
    }
  }, []);
  
  const handleNodeClick = (node: any) => {
    if (fgRef.current) {
       fgRef.current.centerAt(node.x, node.y, 800);
       fgRef.current.zoom(4, 800); // Dramatic zoom in
    }
    onNodeClick(node);
  };

  return (
    <div className={`absolute inset-0 z-0 bg-[#050505] transition-all duration-1000 ${isBlurred ? 'blur-xl scale-110 opacity-30' : 'blur-0 scale-100 opacity-100'}`}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/[0.04] to-transparent pointer-events-none" />
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeCanvasObject={paintNode}
        onNodeClick={handleNodeClick}
        enableNodeDrag={true}
        enableZoomPanInteraction={true}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3} // more dampening for stability
        
        // Native Link Styling
        linkColor={(link: any) => 
          link.target?.memoryState === "thinking" || link.source?.memoryState === "improved" 
            ? 'rgba(100, 200, 255, 0.8)' 
            : 'rgba(255, 255, 255, 0.2)'
        }
        linkWidth={1.5}
        linkCurvature={0.15} // elegant curved links
        
        // Particles
        linkDirectionalParticles={2} // flowing data effect
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleColor={(link: any) => 
          link.target?.memoryState === "thinking" ? 'rgba(100, 200, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)'
        }
      />
    </div>
  );
}
