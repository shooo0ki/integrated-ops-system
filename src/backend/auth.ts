import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import type { SessionOptions } from "iron-session";

export type AppRole = "admin" | "manager" | "member";

export interface SessionUser {
  id: string;       // UserAccount.id
  memberId: string; // Member.id
  email: string;
  role: AppRole;
  name: string;
}

export interface SessionData {
  user?: SessionUser;
}

export const sessionOptions: SessionOptions = {
  password:
    process.env.SESSION_SECRET ??
    "dev-session-secret-32chars-minimum-abc123",
  cookieName: "ios_session",
  cookieOptions: {
    secure: process.env.SESSION_SECURE !== "false",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession() {
  return getIronSession<SessionData>(cookies(), sessionOptions);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session.user ?? null;
}
