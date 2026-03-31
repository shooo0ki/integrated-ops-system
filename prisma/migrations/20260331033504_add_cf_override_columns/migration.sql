-- DropForeignKey
ALTER TABLE "project_assignments" DROP CONSTRAINT "project_assignments_member_id_fkey";

-- AlterTable
ALTER TABLE "pl_records" ADD COLUMN     "cf_cash_in_client_override" INTEGER,
ADD COLUMN     "cf_cash_out_expense_override" INTEGER,
ADD COLUMN     "cf_cash_out_fixed_override" INTEGER,
ADD COLUMN     "cf_cash_out_salary_override" INTEGER;

-- AddForeignKey
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
