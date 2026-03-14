import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(["planning", "active", "completed", "on_hold"]).default("planning"),
  company: z.enum(["boost", "salt2"]),
  projectType: z.enum(["boost_dispatch", "salt2_own"]).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  clientName: z.string().max(200).optional(),
  contractType: z.enum(["quasi_mandate", "contract", "in_house", "other"]).optional().nullable(),
  monthlyContractAmount: z.number().int().min(0).optional().default(0),
  positions: z
    .array(
      z.object({
        positionName: z.string().min(1).max(100),
        requiredCount: z.number().int().min(1).default(1),
      })
    )
    .optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(["planning", "active", "completed", "on_hold"]).optional(),
  company: z.enum(["boost", "salt2"]).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  clientName: z.string().max(200).optional().nullable(),
  contractType: z.enum(["quasi_mandate", "contract", "in_house", "other"]).optional().nullable(),
  monthlyContractAmount: z.number().int().min(0).optional(),
});

export const createAssignmentSchema = z.object({
  positionId: z.string().uuid(),
  memberId: z.string().uuid(),
  workloadHours: z.number().int().min(0).max(744),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});
