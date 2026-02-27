/*
  Warnings:

  - The values [employee,intern] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
-- employee / intern 系の既存データを 'member' に変換してから enum を置き換える
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('admin', 'manager', 'member');
ALTER TABLE "user_accounts" ALTER COLUMN "role" TYPE "UserRole_new" USING (
  CASE "role"::text
    WHEN 'employee'         THEN 'member'
    WHEN 'intern'           THEN 'member'
    WHEN 'intern_full'      THEN 'member'
    WHEN 'intern_training'  THEN 'member'
    WHEN 'training_member'  THEN 'member'
    ELSE "role"::text
  END::"UserRole_new"
);
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
COMMIT;

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "linked_project_id" TEXT,
ADD COLUMN     "taxable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "expense_amount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "pl_records" ADD COLUMN     "cf_company" "Company";

-- CreateIndex
CREATE INDEX "invoice_items_linked_project_id_idx" ON "invoice_items"("linked_project_id");
