export type AppRole = "admin" | "manager" | "member";

export interface SessionUser {
  id: string;       // UserAccount.id
  memberId: string; // Member.id
  email: string;
  role: AppRole;
  name: string;
}
