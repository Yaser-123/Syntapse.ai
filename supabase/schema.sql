-- Syntapse Supabase Schema
-- Copy and paste this into the Supabase SQL Editor to set up your project.

CREATE TABLE IF NOT EXISTS public.pods (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users NOT NULL,
    title text NOT NULL,
    prompt text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.pod_graph_state (
    pod_id uuid REFERENCES public.pods(id) ON DELETE CASCADE PRIMARY KEY,
    nodes jsonb NOT NULL,
    links jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.pod_timeline_events (
    id text PRIMARY KEY,
    pod_id uuid REFERENCES public.pods(id) ON DELETE CASCADE,
    action text NOT NULL,
    node_type text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.pod_module_progress (
    pod_id uuid REFERENCES public.pods(id) ON DELETE CASCADE PRIMARY KEY,
    progress jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_graph_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pod_module_progress ENABLE ROW LEVEL SECURITY;

-- Create Policies to restrict access so users can only see their own data
CREATE POLICY "Allow full access to own pods" ON public.pods FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Allow full access to own pod graph" ON public.pod_graph_state FOR ALL USING (
    EXISTS (SELECT 1 FROM public.pods WHERE pods.id = pod_graph_state.pod_id AND pods.user_id = auth.uid())
);
CREATE POLICY "Allow full access to own pod timeline" ON public.pod_timeline_events FOR ALL USING (
    EXISTS (SELECT 1 FROM public.pods WHERE pods.id = pod_timeline_events.pod_id AND pods.user_id = auth.uid())
);
CREATE POLICY "Allow full access to own pod modules" ON public.pod_module_progress FOR ALL USING (
    EXISTS (SELECT 1 FROM public.pods WHERE pods.id = pod_module_progress.pod_id AND pods.user_id = auth.uid())
);
