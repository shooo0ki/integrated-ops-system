/*
  Warnings:

  - A unique constraint covering the columns `[member_id,target_month,custom_label]` on the table `monthly_self_reports` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "monthly_self_reports" DROP CONSTRAINT "monthly_self_reports_project_id_fkey";

-- AlterTable
ALTER TABLE "monthly_self_reports" ADD COLUMN     "custom_label" VARCHAR(100),
ADD COLUMN     "reported_percent" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "project_id" DROP NOT NULL,
ALTER COLUMN "reported_hours" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "monthly_self_reports_member_id_target_month_custom_label_key" ON "monthly_self_reports"("member_id", "target_month", "custom_label");

-- AddForeignKey
ALTER TABLE "monthly_self_reports" ADD CONSTRAINT "monthly_self_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
