-- AlterTable: memberId を nullable に変更
ALTER TABLE "project_assignments" ALTER COLUMN "member_id" DROP NOT NULL;

-- CreateTable: 月別稼働時間
CREATE TABLE "project_assignment_monthly" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "target_month" CHAR(7) NOT NULL,
    "workload_hours" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_assignment_monthly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_assignment_monthly_assignment_id_idx" ON "project_assignment_monthly"("assignment_id");
CREATE INDEX "project_assignment_monthly_target_month_idx" ON "project_assignment_monthly"("target_month");
CREATE UNIQUE INDEX "project_assignment_monthly_assignment_id_target_month_key" ON "project_assignment_monthly"("assignment_id", "target_month");

-- AddForeignKey
ALTER TABLE "project_assignment_monthly" ADD CONSTRAINT "project_assignment_monthly_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "project_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
