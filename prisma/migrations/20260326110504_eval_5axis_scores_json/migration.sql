/*
  Warnings:

  - You are about to drop the column `score_a` on the `personnel_evaluations` table. All the data in the column will be lost.
  - You are about to drop the column `score_p` on the `personnel_evaluations` table. All the data in the column will be lost.
  - You are about to drop the column `score_s` on the `personnel_evaluations` table. All the data in the column will be lost.
  - Added the required column `scores` to the `personnel_evaluations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "personnel_evaluations" DROP COLUMN "score_a",
DROP COLUMN "score_p",
DROP COLUMN "score_s",
ADD COLUMN     "scores" JSONB NOT NULL;
