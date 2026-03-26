-- AlterTable: PAS(scoreP/scoreA/scoreS) → 5軸 scores JSON
-- 既存データは空オブジェクトで移行
ALTER TABLE "personnel_evaluations"
ADD COLUMN "scores" JSONB;

UPDATE "personnel_evaluations" SET "scores" = '{}' WHERE "scores" IS NULL;

ALTER TABLE "personnel_evaluations"
ALTER COLUMN "scores" SET NOT NULL;

ALTER TABLE "personnel_evaluations"
DROP COLUMN "score_a",
DROP COLUMN "score_p",
DROP COLUMN "score_s";
