import { z } from "zod";

export const createMemberSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.email(),
  password: z.string().min(8),
  phone: z.string().max(20).optional(),
  company: z.enum(["boost", "salt2"]),
  role: z.enum(["admin", "manager", "employee", "intern"]),
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
  status: z
    .enum(["executive", "employee", "intern_full", "intern_training", "training_member"])
    .optional(),
  company: z.enum(["boost", "salt2"]).optional(),
  salaryType: z.enum(["hourly", "monthly"]).optional(),
  salaryAmount: z.number().int().positive().optional(),
  role: z.enum(["admin", "manager", "employee", "intern"]).optional(),
});

export const upsertToolSchema = z.object({
  toolName: z.string().min(1).max(100),
  plan: z.string().max(50).optional(),
  monthlyCost: z.number().int().min(0),
  companyLabel: z.enum(["boost", "salt2"]),
  note: z.string().max(200).optional(),
});
