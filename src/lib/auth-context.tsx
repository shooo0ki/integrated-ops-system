"use client";

import { createContext, useCallback, useContext, useMemo, ReactNode } from "react";
import useSWR, { useSWRConfig } from "swr";
import type { SessionUser } from "./auth";

interface AuthState {
  isLoggedIn: boolean;
  userId: string | null;    // UserAccount.id (UUID)
  memberId: string | null;  // Member.id (UUID)
  role: string;
  name: string | null;      // 表示用: SessionUser.name
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

// 401 を null で返すカスタムフェッチャー（SWRのエラーにしない）
const sessionFetcher = (url: string) =>
  fetch(url).then((r) => (r.ok ? r.json() : null));

export function AuthProvider({ children }: { children: ReactNode }) {
  const { mutate } = useSWRConfig();

  const { data, isLoading } = useSWR<{ user: SessionUser } | null>(
    "/api/auth/session",
    sessionFetcher,
    { dedupingInterval: 60_000, revalidateOnFocus: false }
  );

  const user = data?.user ?? null;
  const state: AuthState = useMemo(
    () =>
      user
        ? {
            isLoggedIn: true,
            userId: user.id,
            memberId: user.memberId,
            role: user.role,
            name: user.name,
          }
        : { isLoggedIn: false, userId: null, memberId: null, role: "member", name: null },
    [user]
  );

  const login = useCallback(async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const responseData = await res.json();
    if (!res.ok) {
      return { success: false, error: responseData.error ?? "ログインに失敗しました。" };
    }
    // SWR キャッシュを更新（再フェッチなし）
    await mutate("/api/auth/session", { user: responseData.user }, false);
    return { success: true };
  }, [mutate]);

  const logout = useCallback(async (): Promise<void> => {
    await fetch("/api/auth/logout", { method: "POST" });
    // SWR キャッシュをクリア（再フェッチなし）
    await mutate("/api/auth/session", null, false);
  }, [mutate]);

  const value = useMemo(
    () => ({ ...state, isLoading, login, logout }),
    [state, isLoading, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
