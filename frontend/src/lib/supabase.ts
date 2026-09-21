import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton browser client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Pod = {
  id: string;
  user_id: string;
  title: string;
  prompt: string;
  created_at: string;
  updated_at: string;
};

export type GraphState = {
  nodes: any[];
  links: any[];
};

export type TimelineEventRow = {
  id: string;
  pod_id: string;
  action: string;
  node_type: string;
  message: string;
  created_at: string;
};
