import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const lowerKey = supabaseAnonKey?.toLowerCase() || "";

const hasRealSupabaseValues =
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes("your-project") &&
  supabaseAnonKey !== "your-anon-key" &&
  !lowerKey.includes("service_role") &&
  !lowerKey.includes("secret") &&
  !lowerKey.includes("admin");

export const supabaseConfigured = Boolean(hasRealSupabaseValues);

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
