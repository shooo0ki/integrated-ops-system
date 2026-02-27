import { z } from "zod";

export const createMemberSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.email(),
  password: z.string().min(8),
  phone: z.string().max(20).optional(),
  role: z.enum(["admin", "manager", "member"]),
  status: z.enum([
    "executive",
    "employee",
    "intern_full",
    "intern_training",
    "training_member",
  ]),
  salaryType: z.enum(["hourly", "monthly"]),
  salaryAmount: z.number().int().positive(),
  joinedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式で入力してください"),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const updateMemberSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  bankName: z.string().max(100).nullable().optional(),
  bankBranch: z.string().max(100).nullable().optional(),
  bankAccountNumber: z.string().max(20).nullable().optional(),
  bankAccountHolder: z.string().max(100).nullable().optional(),
  status: z
    .enum(["executive", "employee", "intern_full", "intern_training", "training_member"])
    .optional(),
  salaryType: z.enum(["hourly", "monthly"]).optional(),
  salaryAmount: z.number().int().positive().optional(),
  role: z.enum(["admin", "manager", "member"]).optional(),
});

export const upsertToolSchema = z.object({
  toolName: z.string().min(1).max(100),
  plan: z.string().max(50).optional(),
  monthlyCost: z.number().int().min(0),
  note: z.string().max(200).optional(),
});

// メンバー自身が編集できるプロフィール項目（住所・口座情報）
export const updateProfileSchema = z.object({
  phone: z.string().max(20).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  bankName: z.string().max(100).nullable().optional(),
  bankBranch: z.string().max(100).nullable().optional(),
  bankAccountNumber: z.string().max(20).nullable().optional(),
  bankAccountHolder: z.string().max(100).nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ステータスからロールを自動導出する
// executive → admin / employee → manager / intern_full,intern_training,training_member → member
export function roleFromStatus(status: string): "admin" | "manager" | "member" {
  if (status === "executive") return "admin";
  if (status === "employee") return "manager";
  return "member";
}
