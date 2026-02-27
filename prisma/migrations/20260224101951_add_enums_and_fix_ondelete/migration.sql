-- =============================================================================
-- Enum型変換マイグレーション
-- USING キャストで VARCHAR → Enum に変換し既存データを保護
-- =============================================================================

-- Step 1: Enum 型を作成
-- -----------------------------------------------------------------------------
CREATE TYPE "UserRole" AS ENUM ('admin', 'manager', 'employee', 'intern');
CREATE TYPE "MemberStatus" AS ENUM ('executive', 'employee', 'intern_full', 'intern_training', 'training_member');
CREATE TYPE "SalaryType" AS ENUM ('hourly', 'monthly');
CREATE TYPE "ProjectStatus" AS ENUM ('planning', 'active', 'completed', 'on_hold');
CREATE TYPE "Company" AS ENUM ('boost', 'salt2');
CREATE TYPE "ProjectType" AS ENUM ('boost_dispatch', 'salt2_own');
CREATE TYPE "ContractType" AS ENUM ('quasi_mandate', 'contract', 'in_house', 'other');
CREATE TYPE "AttendanceStatus" AS ENUM ('normal', 'modified', 'absent');
CREATE TYPE "ConfirmStatus" AS ENUM ('unconfirmed', 'confirmed', 'approved');
CREATE TYPE "SlackSentStatus" AS ENUM ('unsent', 'sent', 'confirmed');
CREATE TYPE "PLRecordType" AS ENUM ('pl', 'cf');
CREATE TYPE "MemberContractStatus" AS ENUM ('draft', 'sent', 'waiting_sign', 'completed', 'voided');
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');
CREATE TYPE "SettlementBasis" AS ENUM ('allocation', 'manual');

-- Step 2: FK 制約を一時削除（列型変更のため）
-- -----------------------------------------------------------------------------
ALTER TABLE "attendance_allocations" DROP CONSTRAINT "attendance_allocations_attendance_id_fkey";
ALTER TABLE "invoice_items" DROP CONSTRAINT "invoice_items_invoice_id_fkey";
ALTER TABLE "pl_records" DROP CONSTRAINT "pl_records_project_id_fkey";

-- Step 3: 変換対象列のインデックスを削除（再作成は Step 6）
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS "attendances_status_confirm_status_idx";
DROP INDEX IF EXISTS "intra_company_settlements_paying_company_receiving_company__idx";
DROP INDEX IF EXISTS "member_contracts_status_idx";
DROP INDEX IF EXISTS "member_tools_company_label_idx";
DROP INDEX IF EXISTS "members_status_idx";
DROP INDEX IF EXISTS "pl_records_target_month_record_type_idx";
DROP INDEX IF EXISTS "pl_records_project_id_target_month_record_type_key";
-- 部分インデックスの WHERE 句が Enum 変換後に IMMUTABLE 違反になるため事前に削除
DROP INDEX IF EXISTS "pl_records_cf_month_unique";
DROP INDEX IF EXISTS "projects_status_idx";
DROP INDEX IF EXISTS "projects_company_idx";

-- Step 4: VARCHAR → Enum 型変換（USING キャストでデータを保護）
-- -----------------------------------------------------------------------------

-- attendances: status / confirm_status（DEFAULT あり）
ALTER TABLE "attendances" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "attendances" ALTER COLUMN "status" TYPE "AttendanceStatus" USING "status"::"AttendanceStatus";
ALTER TABLE "attendances" ALTER COLUMN "status" SET DEFAULT 'normal'::"AttendanceStatus";

ALTER TABLE "attendances" ALTER COLUMN "confirm_status" DROP DEFAULT;
ALTER TABLE "attendances" ALTER COLUMN "confirm_status" TYPE "ConfirmStatus" USING "confirm_status"::"ConfirmStatus";
ALTER TABLE "attendances" ALTER COLUMN "confirm_status" SET DEFAULT 'unconfirmed'::"ConfirmStatus";

-- audit_logs: action（DEFAULT なし、NOT NULL）
ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE "AuditAction" USING "action"::"AuditAction";

-- intra_company_settlements: paying_company / receiving_company / basis
ALTER TABLE "intra_company_settlements" ALTER COLUMN "paying_company" TYPE "Company" USING "paying_company"::"Company";
ALTER TABLE "intra_company_settlements" ALTER COLUMN "receiving_company" TYPE "Company" USING "receiving_company"::"Company";
ALTER TABLE "intra_company_settlements" ALTER COLUMN "basis" DROP DEFAULT;
ALTER TABLE "intra_company_settlements" ALTER COLUMN "basis" TYPE "SettlementBasis" USING "basis"::"SettlementBasis";
ALTER TABLE "intra_company_settlements" ALTER COLUMN "basis" SET DEFAULT 'allocation'::"SettlementBasis";

-- invoices: slack_sent_status（DEFAULT あり）
ALTER TABLE "invoices" ALTER COLUMN "slack_sent_status" DROP DEFAULT;
ALTER TABLE "invoices" ALTER COLUMN "slack_sent_status" TYPE "SlackSentStatus" USING "slack_sent_status"::"SlackSentStatus";
ALTER TABLE "invoices" ALTER COLUMN "slack_sent_status" SET DEFAULT 'unsent'::"SlackSentStatus";

-- member_contracts: status（DEFAULT あり）
ALTER TABLE "member_contracts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "member_contracts" ALTER COLUMN "status" TYPE "MemberContractStatus" USING "status"::"MemberContractStatus";
ALTER TABLE "member_contracts" ALTER COLUMN "status" SET DEFAULT 'draft'::"MemberContractStatus";

-- member_tools: company_label（DEFAULT なし、NOT NULL）
ALTER TABLE "member_tools" ALTER COLUMN "company_label" TYPE "Company" USING "company_label"::"Company";

-- members: status / salary_type（DEFAULT なし、NOT NULL）
ALTER TABLE "members" ALTER COLUMN "status" TYPE "MemberStatus" USING "status"::"MemberStatus";
ALTER TABLE "members" ALTER COLUMN "salary_type" TYPE "SalaryType" USING "salary_type"::"SalaryType";

-- pl_records: record_type（DEFAULT なし、NOT NULL）
ALTER TABLE "pl_records" ALTER COLUMN "record_type" TYPE "PLRecordType" USING "record_type"::"PLRecordType";

-- projects: status / company / project_type / contract_type
ALTER TABLE "projects" ALTER COLUMN "status" TYPE "ProjectStatus" USING "status"::"ProjectStatus";
ALTER TABLE "projects" ALTER COLUMN "company" TYPE "Company" USING "company"::"Company";
ALTER TABLE "projects" ALTER COLUMN "project_type" DROP DEFAULT;
ALTER TABLE "projects" ALTER COLUMN "project_type" TYPE "ProjectType" USING "project_type"::"ProjectType";
ALTER TABLE "projects" ALTER COLUMN "project_type" SET DEFAULT 'salt2_own'::"ProjectType";
ALTER TABLE "projects" ALTER COLUMN "contract_type" TYPE "ContractType" USING "contract_type"::"ContractType";

-- user_accounts: role（DEFAULT なし、NOT NULL）
ALTER TABLE "user_accounts" ALTER COLUMN "role" TYPE "UserRole" USING "role"::"UserRole";

-- Step 5: インデックスを再作成
-- -----------------------------------------------------------------------------
CREATE INDEX "attendances_status_confirm_status_idx" ON "attendances"("status", "confirm_status");
CREATE INDEX "intra_company_settlements_paying_company_receiving_company__idx" ON "intra_company_settlements"("paying_company", "receiving_company", "target_month");
CREATE INDEX "member_contracts_status_idx" ON "member_contracts"("status");
CREATE INDEX "member_tools_company_label_idx" ON "member_tools"("company_label");
CREATE INDEX "members_status_idx" ON "members"("status");
CREATE INDEX "pl_records_target_month_record_type_idx" ON "pl_records"("target_month", "record_type");
CREATE UNIQUE INDEX "pl_records_project_id_target_month_record_type_key" ON "pl_records"("project_id", "target_month", "record_type");
-- Enum キャストで部分インデックスを再作成（WHERE に IMMUTABLE な式を使用）
CREATE UNIQUE INDEX "pl_records_cf_month_unique"
  ON "pl_records"("target_month")
  WHERE "record_type" = 'cf'::"PLRecordType" AND "project_id" IS NULL;
CREATE INDEX "projects_status_idx" ON "projects"("status");
CREATE INDEX "projects_company_idx" ON "projects"("company");

-- Step 6: FK 制約を再追加（onDelete 修正込み）
-- -----------------------------------------------------------------------------
-- invoice_items: Cascade → Restrict（財務履歴保護）
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- pl_records: SET NULL → Restrict（財務履歴保護）
ALTER TABLE "pl_records" ADD CONSTRAINT "pl_records_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- attendance_allocations: Cascade → Restrict（配分履歴保護）
ALTER TABLE "attendance_allocations" ADD CONSTRAINT "attendance_allocations_attendance_id_fkey"
  FOREIGN KEY ("attendance_id") REFERENCES "attendances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
