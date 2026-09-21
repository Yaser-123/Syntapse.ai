"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase, type Pod, type TimelineEventRow } from '@/lib/supabase';
import AuthScreen from '@/components/AuthScreen';
import PodsDashboard from '@/components/PodsDashboard';
import NeuralCanvas from '@/components/NeuralCanvas';
import SpatialCard from '@/components/SpatialCard';
import MemoryTimeline, { TimelineEvent } from '@/components/MemoryTimeline';
import AgentProgress from '@/components/AgentProgress';
import ExportPanel from '@/components/ExportPanel';

type AppView = 'auth' | 'pods' | 'canvas';

interface AgentProgressState {
  agent_name: string;
  pct: number;
  message: string;
  status: 'running' | 'complete' | 'error';
}

// Computed lazily inside components so window is always available
function getBackendUrl() { return `http://${window.location.hostname}:8000`; }
function getWsUrl() { return `ws://${window.location.hostname}:8000`; }

export default function Home() {
  const [view, setView] = useState<AppView>('auth');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [pods, setPods] = useState<Pod[]>([]);
  const [activePod, setActivePod] = useState<Pod | null>(null);

  // Canvas state
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [agentProgress, setAgentProgress] = useState<AgentProgressState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // Always tracks the latest view without stale closure issues
  const viewRef = useRef<AppView>('auth');
  useEffect(() => { viewRef.current = view; }, [view]);

  // ─── Auth check on mount ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserEmail(session.user.email ?? null);
        loadPods();
        setView('pods');
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email ?? null);
        // Only redirect to pods if user is currently on the auth screen
        if (viewRef.current === 'auth') { loadPods(); setView('pods'); }
      } else {
        // Only redirect to auth if not already there
        if (viewRef.current !== 'auth') setView('auth');
        setActivePod(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ─── Load user's pods ───────────────────────────────────────────────────────
  const loadPods = useCallback(async () => {
    const { data } = await supabase
      .from('pods')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setPods(data);
  }, []);

  // ─── Sign out ────────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    wsRef.current?.close();
    await supabase.auth.signOut();
    setView('auth');
    setActivePod(null);
    setGraphData({ nodes: [], links: [] });
    setTimelineEvents([]);
  };

  // ─── Persist graph state to Supabase ────────────────────────────────────────
  const persistGraphState = useCallback(async (podId: string, nodes: any[], links: any[]) => {
    await supabase.from('pod_graph_state').upsert(
      { pod_id: podId, nodes, links, updated_at: new Date().toISOString() },
      { onConflict: 'pod_id' }
    );
  }, []);

  const persistTimelineEvent = useCallback(async (podId: string, event: TimelineEvent) => {
    await supabase.from('pod_timeline_events').upsert({
      id: event.id,
      pod_id: podId,
      action: event.action,
      node_type: event.node_type,
      message: event.message,
    });
  }, []);

  // ─── Load saved state for a pod ─────────────────────────────────────────────
  const sanitizeLinks = useCallback((links: any[]) => {
    return links.map(l => ({
      ...l,
      source: typeof l.source === 'object' ? l.source.id : l.source,
      target: typeof l.target === 'object' ? l.target.id : l.target,
    }));
  }, []);

  const loadPodState = useCallback(async (pod: Pod) => {
    // Load graph
    const { data: graphRow } = await supabase
      .from('pod_graph_state')
      .select('*')
      .eq('pod_id', pod.id)
      .single();

    // Load timeline
    const { data: timelineRows } = await supabase
      .from('pod_timeline_events')
      .select('*')
      .eq('pod_id', pod.id)
      .order('created_at', { ascending: true });

    const savedNodes: any[] = graphRow?.nodes ?? [];
    const savedLinks: any[] = sanitizeLinks(graphRow?.links ?? []);
    const seedNode = { id: 'Raw Prompt', memoryState: 'remembered', data: { prompt: pod.prompt } };
    const seedEvent: TimelineEvent = {
      id: `seed-${pod.id}`,
      action: 'remember',
      node_type: 'Raw Prompt',
      message: 'Initial prompt planted in memory void.',
      timestamp: new Date(pod.created_at).getTime(),
    };

    const allNodes = savedNodes.length > 0 ? savedNodes : [seedNode];
    const allLinks = savedLinks;
    const allEvents: TimelineEvent[] = [seedEvent, ...(timelineRows ?? []).map((r: TimelineEventRow) => ({
      id: r.id,
      action: r.action,
      node_type: r.node_type,
      message: r.message,
      timestamp: new Date(r.created_at).getTime(),
    }))];

    setGraphData({ nodes: allNodes, links: allLinks });
    setTimelineEvents(allEvents);
    return { hasProgress: savedNodes.length > 1 };
  }, []);

  // ─── Open a pod (from dashboard) ────────────────────────────────────────────
  const handleOpenPod = useCallback(async (pod: Pod, prompt: string) => {
    setActivePod(pod);
    setView('canvas');
    setAgentProgress(null);

    const BACKEND = getBackendUrl();
    const WS_BACKEND = getWsUrl();

    const { hasProgress } = await loadPodState(pod);

    let isMounted = true;
    let reconnectTimeout: NodeJS.Timeout;
    
    const connectWs = () => {
      if (!isMounted) return;
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent old handler from triggering
        wsRef.current.close(1000);
      }
      
      const ws = new WebSocket(`${WS_BACKEND}/ws/projects/${pod.id}/graph-stream`);
      wsRef.current = ws;

      ws.onerror = () => console.warn('[WS] Could not connect — backend may not be ready yet. Retrying...');
      ws.onclose = (e) => {
        if (!isMounted) return;
        if (e.code !== 1000) {
          // Only reconnect on unexpected close
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connectWs, 2000);
        }
      };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'graph_mutation') {
        const payload = msg.payload;
        setGraphData(prev => {
          const existingIdx = prev.nodes.findIndex(n => n.id === payload.node_type);
          let newNodes, newLinks;

          if (existingIdx >= 0) {
            newNodes = [...prev.nodes];
            // Mutate the object directly to preserve physics state
            newNodes[existingIdx].memoryState = 'remembered';
            newNodes[existingIdx].data = payload.data;
            newLinks = prev.links;
          } else {
            const newNode = { id: payload.node_type, memoryState: 'thinking', data: payload.data };
            setTimeout(() => {
              setGraphData(curr => {
                const targetNode = curr.nodes.find(n => n.id === newNode.id);
                if (targetNode) targetNode.memoryState = 'remembered';
                return { nodes: [...curr.nodes], links: curr.links };
              });
            }, 2000);

            const PARENT_MAP: Record<string, string> = {
              ideation_node: 'Raw Prompt',
              prd_node: 'ideation_node',
              architecture_node: 'prd_node',
              tech_stack_node: 'architecture_node',
              implementation_strategy_node: 'tech_stack_node',
            };
            const sourceId = PARENT_MAP[newNode.id] || prev.nodes[prev.nodes.length - 1]?.id;
            newNodes = [...prev.nodes, newNode];
            newLinks = [...prev.links, { source: sourceId, target: newNode.id }];
          }

          // Persist to Supabase
          persistGraphState(pod.id, newNodes, newLinks);
          return { nodes: newNodes, links: newLinks };
        });

      } else if (msg.type === 'timeline_event') {
        const payload = msg.payload;
        const evt: TimelineEvent = {
          id: `evt-${Date.now()}-${Math.random()}`,
          action: payload.action as TimelineEvent['action'],
          node_type: payload.node_type,
          message: payload.message,
          timestamp: payload.timestamp,
        };
        setTimelineEvents(prev => [...prev, evt]);
        persistTimelineEvent(pod.id, evt);

      } else if (msg.type === 'agent_progress') {
        const payload = msg.payload;
        setAgentProgress({
          agent_name: payload.agent_name,
          pct: payload.pct,
          message: payload.message,
          status: payload.status || 'running',
        });
      }
    };

      ws.onopen = () => {
        console.log('[WS] Connected to', pod.id);
        if (!hasProgress) {
          fetch(`${BACKEND}/projects/${pod.id}/prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
          }).catch(err => console.error('[fetch /prompt] Error:', err));
        }
      };
    };

    connectWs();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close(1000);
      }
    };
  }, [activePod, loadPodState, persistGraphState, persistTimelineEvent]);

  // ─── Inject Memory ──────────────────────────────────────────────────────────
  const handleInjectMemory = useCallback((newData: any) => {
    if (!selectedNode || !activePod) return;

    const labelMap: Record<string, string> = {
      'ideation_node': 'PRODUCT VISION',
      'prd_node': 'PRODUCT REQUIREMENTS',
      'architecture_node': 'SYSTEM DESIGN',
      'tech_stack_node': 'ENGINEERING STACK',
      'implementation_strategy_node': 'BUILD STRATEGY',
    };
    const nodeName = labelMap[selectedNode.id] || selectedNode.id.replace('_node', '').replace(/_/g, ' ').toUpperCase();

    const improveEvt: TimelineEvent = {
      id: `evt-imp-${Date.now()}-${Math.random()}`,
      action: 'improve' as const,
      node_type: selectedNode.id,
      message: `${nodeName} memory actively healed by user.`,
      timestamp: Date.now(),
    };
    setTimelineEvents(prev => [...prev, improveEvt]);
    persistTimelineEvent(activePod.id, improveEvt);

    setGraphData(prev => {
      const targetNode = prev.nodes.find(n => n.id === selectedNode.id);
      if (targetNode) {
        targetNode.memoryState = 'improved';
        targetNode.data = { data: newData };
      }
      return { ...prev, nodes: [...prev.nodes] };
    });

    setTimeout(() => {
      let downstreamNodes: string[] = [];
      setGraphData(prev => {
        let foundEdited = false;
        downstreamNodes = [];
        prev.nodes.forEach(n => {
          if (n.id === selectedNode.id) { foundEdited = true; }
          else if (foundEdited) { downstreamNodes.push(n.id); }
        });
        
        const updatedNodes = prev.nodes.filter(n => !downstreamNodes.includes(n.id));
        
        const updatedLinks = prev.links.filter(l => {
          const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
          const targetId = typeof l.target === 'object' ? l.target.id : l.target;
          return !downstreamNodes.includes(sourceId) && !downstreamNodes.includes(targetId);
        });

        persistGraphState(activePod.id, updatedNodes, updatedLinks);
        return { nodes: updatedNodes, links: updatedLinks };
      });

      setTimeout(() => {
        if (downstreamNodes.length > 0) {
          setTimelineEvents(evts => {
            const newEvts: TimelineEvent[] = downstreamNodes.map(nId => {
              const labelMap: Record<string, string> = {
                'ideation_node': 'PRODUCT VISION',
                'prd_node': 'PRODUCT REQUIREMENTS',
                'architecture_node': 'SYSTEM DESIGN',
                'tech_stack_node': 'ENGINEERING STACK',
                'implementation_strategy_node': 'BUILD STRATEGY',
              };
              const nName = labelMap[nId] || nId.replace('_node', '').toUpperCase();
              
              return {
                id: `evt-fgt-${nId}-${Date.now()}-${Math.random()}`,
                action: 'forget' as const,
                node_type: nId,
                message: `Stale ${nName} memory discarded.`,
                timestamp: Date.now(),
              };
            });
            newEvts.forEach(e => persistTimelineEvent(activePod.id, e));
            return [...evts, ...newEvts];
          });
        }
        setTimeout(() => {
          setGraphData(prev => {
            const targetNode = prev.nodes.find(n => n.id === selectedNode.id);
            if (targetNode) targetNode.memoryState = 'remembered';
            return { nodes: [...prev.nodes], links: prev.links };
          });
        }, 1500);
      }, 0);
    }, 300);

    fetch(`${getBackendUrl()}/projects/${activePod.id}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_type: selectedNode.id, data: newData }),
    });

    setSelectedNode(null);
  }, [selectedNode, activePod, persistGraphState, persistTimelineEvent]);

  const handleTimelineClick = (nodeType: string) => {
    const target = graphData.nodes.find(n => n.id === nodeType);
    if (target) setSelectedNode(target);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (view === 'auth') return <AuthScreen onAuth={() => { loadPods(); setView('pods'); }} />;

  if (view === 'pods') return (
    <PodsDashboard
      user={{ email: userEmail ?? undefined }}
      pods={pods}
      onOpenPod={handleOpenPod}
      onPodsChange={loadPods}
      onSignOut={handleSignOut}
    />
  );

  return (
    <main className="relative min-h-screen bg-black overflow-hidden font-sans">
      {/* Back to pods */}
      <button
        onClick={() => { wsRef.current?.close(); setView('pods'); loadPods(); }}
        className="absolute top-5 left-5 z-50 flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition-all backdrop-blur-md shadow-lg"
      >
        ← Pods
      </button>

      {/* Pod title */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50">
        <p className="text-white/70 text-sm font-medium border border-white/20 bg-white/5 px-5 py-2 rounded-xl backdrop-blur-md shadow-lg">
          {activePod?.title}
        </p>
      </div>

      <MemoryTimeline
        events={timelineEvents}
        activeNodeId={selectedNode?.id || null}
        onEventClick={handleTimelineClick}
      />
      <div className="absolute inset-0">
        <NeuralCanvas
          graphData={graphData}
          onNodeClick={setSelectedNode}
          isBlurred={!!selectedNode}
        />
        <SpatialCard
          selectedNode={selectedNode}
          onClose={() => setSelectedNode(null)}
          onInject={handleInjectMemory}
          podId={activePod?.id}
        />
      </div>
      <AgentProgress progress={agentProgress} />
      <ExportPanel graphData={graphData} projectId={activePod?.id ?? null} />
    </main>
  );
}
