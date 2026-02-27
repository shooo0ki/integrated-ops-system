-- =============================================================================
-- HIGH優先度アンチパターン修正マイグレーション
-- 2026-02-24
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. invoices.slack_sent_status: VARCHAR(10) → VARCHAR(30)
--    'accounting_sent'(15文字) / 'confirmed'(9文字) を格納できるよう拡張
-- -----------------------------------------------------------------------------
ALTER TABLE "invoices" ALTER COLUMN "slack_sent_status" SET DATA TYPE VARCHAR(30);

-- -----------------------------------------------------------------------------
-- 2. skills: カテゴリ内表示順インデックス追加
-- -----------------------------------------------------------------------------
CREATE INDEX "skills_category_id_display_order_idx" ON "skills"("category_id", "display_order");

-- -----------------------------------------------------------------------------
-- 3. member_skills: evaluated_at を DESC インデックスに変更
--    最新評価の取得 (ORDER BY evaluated_at DESC) を高速化
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS "member_skills_member_id_skill_id_evaluated_at_idx";
CREATE INDEX "member_skills_member_id_skill_id_evaluated_at_idx"
  ON "member_skills"("member_id", "skill_id", "evaluated_at" DESC);

-- -----------------------------------------------------------------------------
-- 4. personnel_evaluations: target_period を DESC インデックスに変更
--    最新評価履歴の取得を高速化
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS "personnel_evaluations_member_id_target_period_idx";
CREATE INDEX "personnel_evaluations_member_id_target_period_idx"
  ON "personnel_evaluations"("member_id", "target_period" DESC);

-- -----------------------------------------------------------------------------
-- 5. pl_records: CF重複防止のための部分ユニークインデックス
--    PostgreSQL は NULL != NULL のため @@unique だけでは防げない既知問題を修正
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX "pl_records_cf_month_unique"
  ON "pl_records"("target_month")
  WHERE "record_type" = 'cf' AND "project_id" IS NULL;

-- =============================================================================
-- CHECK制約（数値・範囲・論理制約）
-- Prisma はCHECK制約を自動生成しないため手動で追加
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 6. members
--    salary_amount: マイナス給与を禁止
--    left_at >= joined_at: 退社日 < 入社日 の不合理なデータを禁止
-- -----------------------------------------------------------------------------
ALTER TABLE "members"
  ADD CONSTRAINT "members_salary_amount_check"
    CHECK ("salary_amount" >= 0),
  ADD CONSTRAINT "members_date_order_check"
    CHECK ("left_at" IS NULL OR "left_at" >= "joined_at");

-- -----------------------------------------------------------------------------
-- 7. member_skills
--    level: 1〜5 の範囲を強制
-- -----------------------------------------------------------------------------
ALTER TABLE "member_skills"
  ADD CONSTRAINT "member_skills_level_check"
    CHECK ("level" >= 1 AND "level" <= 5);

-- -----------------------------------------------------------------------------
-- 8. project_positions
--    required_count: 0以下の必要人数を禁止
-- -----------------------------------------------------------------------------
ALTER TABLE "project_positions"
  ADD CONSTRAINT "project_positions_required_count_check"
    CHECK ("required_count" >= 1);

-- -----------------------------------------------------------------------------
-- 9. position_required_skills
--    min_level: 1〜5 の範囲を強制
-- -----------------------------------------------------------------------------
ALTER TABLE "position_required_skills"
  ADD CONSTRAINT "position_required_skills_min_level_check"
    CHECK ("min_level" >= 1 AND "min_level" <= 5);

-- -----------------------------------------------------------------------------
-- 10. projects
--    end_date >= start_date: 終了日が開始日より前を禁止
--    monthly_contract_amount: マイナス契約金額を禁止
-- -----------------------------------------------------------------------------
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_date_order_check"
    CHECK ("end_date" IS NULL OR "end_date" >= "start_date"),
  ADD CONSTRAINT "projects_monthly_amount_check"
    CHECK ("monthly_contract_amount" >= 0);

-- -----------------------------------------------------------------------------
-- 11. project_assignments
--    workload_hours: 0工数アサインを禁止
--    end_date >= start_date: 逆順期間を禁止
-- -----------------------------------------------------------------------------
ALTER TABLE "project_assignments"
  ADD CONSTRAINT "project_assignments_workload_hours_check"
    CHECK ("workload_hours" >= 1),
  ADD CONSTRAINT "project_assignments_date_order_check"
    CHECK ("end_date" IS NULL OR "end_date" >= "start_date");

-- -----------------------------------------------------------------------------
-- 12. attendances
--    clock_out > clock_in: 退勤時刻が出勤時刻より前を禁止
--    break_minutes >= 0: マイナス休憩時間を禁止
--    work_minutes >= 0: マイナス実働時間を禁止
-- -----------------------------------------------------------------------------
ALTER TABLE "attendances"
  ADD CONSTRAINT "attendances_clock_order_check"
    CHECK ("clock_out" IS NULL OR "clock_out" > "clock_in"),
  ADD CONSTRAINT "attendances_break_minutes_check"
    CHECK ("break_minutes" >= 0),
  ADD CONSTRAINT "attendances_work_minutes_check"
    CHECK ("work_minutes" IS NULL OR "work_minutes" >= 0);

-- -----------------------------------------------------------------------------
-- 13. invoices
--    unit_price > 0: 0円・マイナス単価を禁止
--    work_hours_total >= 0: マイナス稼働時間を禁止
--    amount_excl_tax / amount_incl_tax / amount_boost / amount_salt2 >= 0
-- -----------------------------------------------------------------------------
ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_unit_price_check"
    CHECK ("unit_price" >= 0),
  ADD CONSTRAINT "invoices_work_hours_check"
    CHECK ("work_hours_total" >= 0),
  ADD CONSTRAINT "invoices_amount_excl_tax_check"
    CHECK ("amount_excl_tax" >= 0),
  ADD CONSTRAINT "invoices_amount_incl_tax_check"
    CHECK ("amount_incl_tax" >= 0),
  ADD CONSTRAINT "invoices_amount_boost_check"
    CHECK ("amount_boost" >= 0),
  ADD CONSTRAINT "invoices_amount_salt2_check"
    CHECK ("amount_salt2" >= 0);

-- -----------------------------------------------------------------------------
-- 14. pl_records
--    全 revenue_* / cost_* / cf_cash_* カラムにマイナス値を禁止
-- -----------------------------------------------------------------------------
ALTER TABLE "pl_records"
  ADD CONSTRAINT "pl_records_revenue_contract_check"
    CHECK ("revenue_contract" >= 0),
  ADD CONSTRAINT "pl_records_revenue_extra_check"
    CHECK ("revenue_extra" >= 0),
  ADD CONSTRAINT "pl_records_cost_labor_monthly_check"
    CHECK ("cost_labor_monthly" >= 0),
  ADD CONSTRAINT "pl_records_cost_labor_hourly_check"
    CHECK ("cost_labor_hourly" >= 0),
  ADD CONSTRAINT "pl_records_cost_outsourcing_check"
    CHECK ("cost_outsourcing" >= 0),
  ADD CONSTRAINT "pl_records_cost_tools_check"
    CHECK ("cost_tools" >= 0),
  ADD CONSTRAINT "pl_records_cost_other_check"
    CHECK ("cost_other" >= 0),
  ADD CONSTRAINT "pl_records_cf_cash_in_client_check"
    CHECK ("cf_cash_in_client" >= 0),
  ADD CONSTRAINT "pl_records_cf_cash_in_other_check"
    CHECK ("cf_cash_in_other" >= 0),
  ADD CONSTRAINT "pl_records_cf_cash_out_salary_check"
    CHECK ("cf_cash_out_salary" >= 0),
  ADD CONSTRAINT "pl_records_cf_cash_out_outsourcing_check"
    CHECK ("cf_cash_out_outsourcing" >= 0),
  ADD CONSTRAINT "pl_records_cf_cash_out_fixed_check"
    CHECK ("cf_cash_out_fixed" >= 0),
  ADD CONSTRAINT "pl_records_cf_cash_out_other_check"
    CHECK ("cf_cash_out_other" >= 0);

-- -----------------------------------------------------------------------------
-- 15. intra_company_settlements
--    paying_company <> receiving_company: 自社→自社の精算を禁止
--    amount > 0: 0円・マイナス精算を禁止
-- -----------------------------------------------------------------------------
ALTER TABLE "intra_company_settlements"
  ADD CONSTRAINT "intra_company_settlements_direction_check"
    CHECK ("paying_company" <> "receiving_company"),
  ADD CONSTRAINT "intra_company_settlements_amount_check"
    CHECK ("amount" > 0);

-- -----------------------------------------------------------------------------
-- 16. personnel_evaluations
--    score_p / score_a / score_s: 1〜5 の範囲を強制
-- -----------------------------------------------------------------------------
ALTER TABLE "personnel_evaluations"
  ADD CONSTRAINT "personnel_evaluations_score_p_check"
    CHECK ("score_p" >= 1 AND "score_p" <= 5),
  ADD CONSTRAINT "personnel_evaluations_score_a_check"
    CHECK ("score_a" >= 1 AND "score_a" <= 5),
  ADD CONSTRAINT "personnel_evaluations_score_s_check"
    CHECK ("score_s" >= 1 AND "score_s" <= 5);
