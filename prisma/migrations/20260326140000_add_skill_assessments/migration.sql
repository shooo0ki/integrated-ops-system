-- CreateTable: skill_assessments（スキル評価 5軸 — 人事評価とは別データ）
CREATE TABLE "skill_assessments" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "evaluator_id" TEXT NOT NULL,
    "target_period" CHAR(7) NOT NULL,
    "scores" JSONB NOT NULL,
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skill_assessments_member_id_target_period_key" ON "skill_assessments"("member_id", "target_period");
CREATE INDEX "skill_assessments_member_id_target_period_idx" ON "skill_assessments"("member_id", "target_period" DESC);
CREATE INDEX "skill_assessments_evaluator_id_idx" ON "skill_assessments"("evaluator_id");

-- AddForeignKey
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "skill_assessments" ADD CONSTRAINT "skill_assessments_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
