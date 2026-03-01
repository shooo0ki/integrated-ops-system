"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { SessionUser } from "./auth";

interface AuthState {
  isLoggedIn: boolean;
  userId: string | null;    // UserAccount.id (UUID)
  memberId: string | null;  // Member.id (UUID)
  role: string;
  name: string | null;      // 表示用: SessionUser.name
}

interface AuthContextValue extends AuthState {
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoggedIn: false,
    userId: null,
    memberId: null,
    role: "member",
    name: null,
  });

  // 初回マウント時にセッションを復元
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user: SessionUser } | null) => {
        if (data?.user) {
          setState({
            isLoggedIn: true,
            userId: data.user.id,
            memberId: data.user.memberId,
            role: data.user.role,
            name: data.user.name,
          });
        }
      })
      .catch(() => {/* セッションなし */});
  }, []);

  async function login(
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error ?? "ログインに失敗しました。" };
    }
    const user: SessionUser = data.user;
    setState({
      isLoggedIn: true,
      userId: user.id,
      memberId: user.memberId,
      role: user.role,
      name: user.name,
    });
    return { success: true };
  }

  async function logout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" });
    setState({ isLoggedIn: false, userId: null, memberId: null, role: "member", name: null });
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
