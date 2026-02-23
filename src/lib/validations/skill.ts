import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  displayOrder: z.number().int().min(1).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  displayOrder: z.number().int().min(1).optional(),
});

export const createSkillSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(200).optional(),
  displayOrder: z.number().int().min(1).optional(),
});

export const updateSkillSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(200).optional(),
  displayOrder: z.number().int().min(1).optional(),
});

export const createSkillEvalSchema = z.object({
  skillId: z.string().uuid(),
  level: z.number().int().min(1).max(5),
  evaluatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  memo: z.string().max(500).optional(),
});
