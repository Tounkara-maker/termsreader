import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabase, initSupabaseWithConfig } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (token: string) => {
    try {
      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else if (res.status === 401) {
        console.warn("Stale or invalid auth session detected by server. Signing out.");
        const supabase = getSupabase();
        if (supabase) {
          await supabase.auth.signOut();
        }
        setProfile(null);
        setSession(null);
        setUser(null);
      } else {
        console.warn("Profile API returned non-OK status:", res.status);
        setProfile((prev: any) => prev || {
          id: user?.id,
          email: user?.email,
          plan: "free",
          analyses_count: 0,
          preferences: null
        });
      }
    } catch (err) {
      console.error("Profile fetch error", err);
      setProfile((prev: any) => prev || {
        id: user?.id,
        email: user?.email,
        plan: "free",
        analyses_count: 0,
        preferences: null
      });
    }
  };

  useEffect(() => {
    let subscription: any = null;

    const initAuth = async () => {
      let client = getSupabase();

      if (!client) {
        try {
          const res = await fetch("/api/config");
          if (res.ok) {
            const cfg = await res.json();
            if (cfg.VITE_SUPABASE_URL && cfg.VITE_SUPABASE_ANON_KEY) {
              client = initSupabaseWithConfig(cfg.VITE_SUPABASE_URL, cfg.VITE_SUPABASE_ANON_KEY);
            }
          }
        } catch (e) {
          console.error("Error fetching runtime config:", e);
        }
      }

      if (!client) {
        setLoading(false);
        return;
      }

      // Get initial session
      client.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.access_token) {
          fetchProfile(session.access_token).finally(() => setLoading(false));
          // Sync with extension content script
          window.postMessage({ type: "TERMSREADER_SESSION", token: session.access_token, apiUrl: window.location.origin }, "*");
        } else {
          setLoading(false);
        }
      });

      // Listen for auth changes
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.access_token) {
          fetchProfile(session.access_token);
          // Sync with extension content script
          window.postMessage({ type: "TERMSREADER_SESSION", token: session.access_token, apiUrl: window.location.origin }, "*");
        } else {
          setProfile(null);
          window.postMessage({ type: "TERMSREADER_LOGOUT" }, "*");
        }
      });
      subscription = data.subscription;
    };

    initAuth();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (session?.access_token) {
      await fetchProfile(session.access_token);
    }
  };

  const signOut = async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
