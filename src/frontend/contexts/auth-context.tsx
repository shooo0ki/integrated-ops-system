"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  ReactNode,
} from "react";
import { authClient } from "@/frontend/lib/auth-client";
import type { AppRole } from "@/backend/auth";

// ─────────────────────────────────────────────
// 型定義 (既存コードとの互換性を維持)
// ─────────────────────────────────────────────

interface AuthState {
  isLoggedIn: boolean;
  userId: string | null;    // UserAccount.id (UUID)
  memberId: string | null;  // Member.id (UUID)
  role: string;
  name: string | null;      // 表示用
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
// Provider
// ─────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const { mutate } = useSWRConfig();

  const {
    data: session,
    isPending: isLoading,
  } = authClient.useSession();

  // Better Auth セッション取得後、業務に必要な追加情報を取得
  // (role, memberId は user_accounts 経由で取るため別途 fetch)
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
      const result = await authClient.signIn.email({
        email,
        password,
      });
      if (result.error) {
        return {
          success: false,
          error: "メールアドレスまたはパスワードが正しくありません。",
        };
      }
      // ログイン成功 → セッション & プロフィールを即時再取得
      await mutate("/api/auth/profile");
      return { success: true };
    },
    [mutate]
  );

  const logout = useCallback(async (): Promise<void> => {
    await authClient.signOut();
    await mutate("/api/auth/profile", null, false);
  }, [mutate]);

  const value = useMemo(
    () => ({
      ...state,
      isLoading: isLoading || isProfileLoading,
      login,
      logout,
    }),
    [state, isLoading, isProfileLoading, login, logout]
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

// ─────────────────────────────────────────────
// 業務プロフィール取得 (role, memberId)
// ─────────────────────────────────────────────

import useSWR, { useSWRConfig } from "swr";

interface UserProfile {
  memberId: string;
  role: AppRole;
}

const profileFetcher = (url: string) =>
  fetch(url, { credentials: "same-origin", cache: "no-store" }).then((r) =>
    r.ok ? r.json() : null
  );

function useFetchProfile(userId: string | null) {
  const { data, isLoading: isPending } = useSWR<UserProfile | null>(
    userId ? "/api/auth/profile" : null,
    profileFetcher,
    { dedupingInterval: 60_000, revalidateOnFocus: false }
  );
  return { data: data ?? null, isPending };
}
