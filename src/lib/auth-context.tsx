"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { MEMBERS, type Member } from "./mock-data";
import type { SessionUser } from "./auth";

interface AuthState {
  isLoggedIn: boolean;
  userId: string | null;    // UserAccount.id (UUID)
  memberId: string | null;  // Member.id (UUID)
  role: string;
  member: Member | null;
}

interface AuthContextValue extends AuthState {
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchRole: (role: string) => void; // デモ互換stub（実APIでは無効）
}

const AuthContext = createContext<AuthContextValue | null>(null);

// セッションユーザーを名前でモックデータに紐付ける（移行期間中の後方互換）
function findMockMember(u: SessionUser): Member | null {
  return MEMBERS.find((m) => m.name === u.name) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoggedIn: false,
    userId: null,
    memberId: null,
    role: "employee",
    member: null,
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
            member: findMockMember(data.user),
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
      member: findMockMember(user),
    });
    return { success: true };
  }

  async function logout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" });
    setState({ isLoggedIn: false, userId: null, memberId: null, role: "employee", member: null });
  }

  // デモ互換: 実APIでは役割切替を行わない
  function switchRole(_role: string) {
    console.warn("switchRole is disabled in production auth mode");
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
