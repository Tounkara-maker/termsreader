import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;

  const windowEnv = (typeof window !== 'undefined' && (window as any).__ENV__) || {};

  const supabaseUrl =
    windowEnv.VITE_SUPABASE_URL ||
    (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined);

  const supabaseAnonKey =
    windowEnv.VITE_SUPABASE_ANON_KEY ||
    (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined);

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
}

export const initSupabaseWithConfig = (url: string, anonKey: string): SupabaseClient => {
  if (url && anonKey) {
    if (typeof window !== 'undefined') {
      (window as any).__ENV__ = {
        ...(window as any).__ENV__,
        VITE_SUPABASE_URL: url,
        VITE_SUPABASE_ANON_KEY: anonKey,
      };
    }
    supabaseInstance = createClient(url, anonKey);
  }
  return supabaseInstance!;
}

// Export the instance directly for convenience, but it may be null if vars are missing
export const supabase = getSupabase();
