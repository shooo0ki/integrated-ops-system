-- CreateTable
CREATE TABLE "personnel_evaluations" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "evaluator_id" TEXT NOT NULL,
    "target_period" CHAR(7) NOT NULL,
    "score_p" INTEGER NOT NULL,
    "score_a" INTEGER NOT NULL,
    "score_s" INTEGER NOT NULL,
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personnel_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personnel_evaluations_member_id_target_period_key" ON "personnel_evaluations"("member_id", "target_period");

-- AddForeignKey
ALTER TABLE "personnel_evaluations" ADD CONSTRAINT "personnel_evaluations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_evaluations" ADD CONSTRAINT "personnel_evaluations_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
