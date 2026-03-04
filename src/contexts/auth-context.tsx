"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface AuthProfile {
  id: string;
  name: string;
  email: string | null;
  department: string;
  role: string | null;
  auth_id: string;
  avatar_url?: string | null;
}

interface AuthContextValue {
  user: User | null;
  profile: AuthProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (authId: string) => {
    const { data } = await supabase
      .from("users")
      .select("id, name, email, department, role, auth_id, avatar_url")
      .eq("auth_id", authId)
      .single();
    if (data) {
      setProfile(data as AuthProfile);
    } else {
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    } else {
      setProfile(null);
    }
  }, [fetchProfile]);

  useEffect(() => {
    let cancelled = false;
    let loadingStopped = false;

    const stopLoading = () => {
      if (!loadingStopped) {
        loadingStopped = true;
        setLoading(false);
      }
    };

    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        setUser(session?.user ?? null);
        stopLoading();
        if (session?.user?.id) {
          fetchProfile(session.user.id).then(() => {});
        } else {
          setProfile(null);
        }
      } catch {
        if (!cancelled) stopLoading();
      }
    };

    init();
    const t = setTimeout(stopLoading, 4000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        fetchProfile(session.user.id).then(() => {});
      } else {
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(t);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    []
  );

  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (authError) return { error: authError.message };

      if (authData.user) {
        const { error: userError } = await supabase.from("users").insert({
          id: crypto.randomUUID(),
          name: name.trim(),
          email: email.trim(),
          department: "Geral",
          auth_id: authData.user.id,
          is_active: true,
        });
        if (userError) return { error: userError.message };
      }
      return { error: null };
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, refreshProfile, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
