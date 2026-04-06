"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  ReactNode,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import { authClient } from "@/frontend/lib/auth-client";
import type { AppRole } from "@/shared/types/auth";

// ─────────────────────────────────────────────
// 型定義 (既存コードとの互換性を維持)
// ─────────────────────────────────────────────

interface AuthState {
  isLoggedIn: boolean;
  userId: string | null;
  memberId: string | null;
  role: string;
  name: string | null;
}

interface AuthContextValue extends AuthState {
  isLoading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─────────────────────────────────────────────
// プロフィール取得 (role, memberId)
// ─────────────────────────────────────────────

interface UserProfile {
  memberId: string;
  role: AppRole;
}

const profileFetcher = async (url: string): Promise<UserProfile | null> => {
  const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
  return res.json();
};

function useFetchProfile(userId: string | null) {
  const { data, isLoading } = useSWR<UserProfile | null>(
    userId ? "/api/auth/profile" : null,
    profileFetcher,
    { dedupingInterval: 60_000, revalidateOnFocus: false }
  );
  return { data: data ?? null, isPending: isLoading };
}

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const { mutate } = useSWRConfig();

  const {
    data: session,
    isPending: isSessionLoading,
  } = authClient.useSession();

  const {
    data: profile,
    isPending: isProfileLoading,
  } = useFetchProfile(session?.user?.id ?? null);

  const state: AuthState = useMemo(() => {
    if (!session?.user || !profile) {
      return {
        isLoggedIn: false,
        userId: null,
        memberId: null,
        role: "member",
        name: null,
      };
    }
    return {
      isLoggedIn: true,
      userId: session.user.id,
      memberId: profile.memberId,
      role: profile.role,
      name: session.user.name,
    };
  }, [session, profile]);

  const login = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ success: boolean; error?: string }> => {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        return {
          success: false,
          error: "メールアドレスまたはパスワードが正しくありません。",
        };
      }
      // セッション確立後にプロフィールを即時取得
      await mutate("/api/auth/profile");
      return { success: true };
    },
    [mutate]
  );

  const logout = useCallback(async (): Promise<void> => {
    await authClient.signOut();
    await mutate("/api/auth/profile", null, { revalidate: false });
  }, [mutate]);

  const value = useMemo(
    () => ({
      ...state,
      isLoading: isSessionLoading || isProfileLoading,
      login,
      logout,
    }),
    [state, isSessionLoading, isProfileLoading, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
