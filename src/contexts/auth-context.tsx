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
  is_active?: boolean | null;
  avatar_url?: string | null;
  permissions?: string[] | null;
  ferias_view_enabled?: boolean | null;
  must_change_password?: boolean | null;
  content_tutorial_completed_at?: string | null;
  meus_clientes_tutorial_completed_at?: string | null;
  newsletter_tutorial_completed_at?: string | null;
  minhas_fotos_tutorial_completed_at?: string | null;
  qualification_required_at?: string | null;
  qualification_completed_at?: string | null;
  gustavo_content_member?: boolean;
  gustavo_content_member_role?: "owner" | "editor" | null;
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

function recordLastSeen() {
  fetch("/api/account/last-seen", { method: "POST", credentials: "include" }).catch(() => {});
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (authId: string) => {
    // Tenta algumas vezes: logo após o login a sessão pode não estar pronta
    // para o cliente (RLS), o que retornaria erro transitório.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email, department, role, auth_id, is_active, avatar_url, permissions, ferias_view_enabled, must_change_password, content_tutorial_completed_at, meus_clientes_tutorial_completed_at, newsletter_tutorial_completed_at, minhas_fotos_tutorial_completed_at, qualification_required_at, qualification_completed_at")
        .eq("auth_id", authId)
        .maybeSingle();
      if (data) {
        if (data.is_active === false) {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          return;
        }
        const { data: membership } = await supabase
          .from("gustavo_content_members")
          .select("member_role")
          .eq("user_id", data.id)
          .maybeSingle();
        setProfile({
          ...(data as AuthProfile),
          gustavo_content_member: Boolean(membership),
          gustavo_content_member_role:
            membership?.member_role === "owner" || membership?.member_role === "editor"
              ? membership.member_role
              : null,
        });
        return;
      }
      if (!error) {
        // Consulta ok, porém sem linha: usuário sem cadastro em users.
        setProfile(null);
        return;
      }
      // Erro transitório: aguarda e tenta de novo (não zera o perfil atual).
      await new Promise((r) => setTimeout(r, 600));
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
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
          error,
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (error) {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          stopLoading();
          return;
        }
        setUser(session?.user ?? null);
        stopLoading();
        if (session?.user?.id) {
          recordLastSeen();
          fetchProfile(session.user.id).then(() => {});
        } else {
          setProfile(null);
        }
      } catch {
        if (!cancelled) {
          await supabase.auth.signOut().catch(() => {});
          setUser(null);
          setProfile(null);
          stopLoading();
        }
      }
    };

    init();
    const t = setTimeout(stopLoading, 4000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          recordLastSeen();
        }
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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };

      const { data: appUser, error: profileError } = await supabase
        .from("users")
        .select("is_active")
        .eq("auth_id", data.user.id)
        .maybeSingle();
      if (profileError || !appUser || appUser.is_active === false) {
        await supabase.auth.signOut();
        return {
          error:
            appUser?.is_active === false
              ? "Usuário inativo. Procure o administrador."
              : "Usuário sem cadastro ativo no sistema.",
        };
      }

      return { error: null };
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
