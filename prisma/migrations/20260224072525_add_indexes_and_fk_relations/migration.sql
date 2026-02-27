-- CreateIndex
CREATE INDEX "attendance_allocations_project_id_idx" ON "attendance_allocations"("project_id");

-- CreateIndex
CREATE INDEX "attendances_date_idx" ON "attendances"("date");

-- CreateIndex
CREATE INDEX "attendances_status_confirm_status_idx" ON "attendances"("status", "confirm_status");

-- CreateIndex
CREATE INDEX "audit_logs_operator_id_idx" ON "audit_logs"("operator_id");

-- CreateIndex
CREATE INDEX "audit_logs_target_table_target_id_idx" ON "audit_logs"("target_table", "target_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "intra_company_settlements_target_month_idx" ON "intra_company_settlements"("target_month");

-- CreateIndex
CREATE INDEX "intra_company_settlements_paying_company_receiving_company__idx" ON "intra_company_settlements"("paying_company", "receiving_company", "target_month");

-- CreateIndex
CREATE INDEX "intra_company_settlements_member_id_idx" ON "intra_company_settlements"("member_id");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "invoices_target_month_idx" ON "invoices"("target_month");

-- CreateIndex
CREATE INDEX "member_contracts_member_id_idx" ON "member_contracts"("member_id");

-- CreateIndex
CREATE INDEX "member_contracts_status_idx" ON "member_contracts"("status");

-- CreateIndex
CREATE INDEX "member_contracts_envelope_id_idx" ON "member_contracts"("envelope_id");

-- CreateIndex
CREATE INDEX "member_skills_member_id_skill_id_evaluated_at_idx" ON "member_skills"("member_id", "skill_id", "evaluated_at");

-- CreateIndex
CREATE INDEX "member_skills_skill_id_idx" ON "member_skills"("skill_id");

-- CreateIndex
CREATE INDEX "member_skills_evaluated_by_idx" ON "member_skills"("evaluated_by");

-- CreateIndex
CREATE INDEX "member_tools_member_id_idx" ON "member_tools"("member_id");

-- CreateIndex
CREATE INDEX "member_tools_company_label_idx" ON "member_tools"("company_label");

-- CreateIndex
CREATE INDEX "members_deleted_at_idx" ON "members"("deleted_at");

-- CreateIndex
CREATE INDEX "members_status_idx" ON "members"("status");

-- CreateIndex
CREATE INDEX "monthly_self_reports_member_id_target_month_idx" ON "monthly_self_reports"("member_id", "target_month");

-- CreateIndex
CREATE INDEX "monthly_self_reports_project_id_target_month_idx" ON "monthly_self_reports"("project_id", "target_month");

-- CreateIndex
CREATE INDEX "personnel_evaluations_member_id_target_period_idx" ON "personnel_evaluations"("member_id", "target_period");

-- CreateIndex
CREATE INDEX "personnel_evaluations_evaluator_id_idx" ON "personnel_evaluations"("evaluator_id");

-- CreateIndex
CREATE INDEX "pl_records_project_id_target_month_idx" ON "pl_records"("project_id", "target_month");

-- CreateIndex
CREATE INDEX "pl_records_target_month_record_type_idx" ON "pl_records"("target_month", "record_type");

-- CreateIndex
CREATE INDEX "position_required_skills_skill_id_idx" ON "position_required_skills"("skill_id");

-- CreateIndex
CREATE INDEX "project_assignments_project_id_idx" ON "project_assignments"("project_id");

-- CreateIndex
CREATE INDEX "project_assignments_member_id_idx" ON "project_assignments"("member_id");

-- CreateIndex
CREATE INDEX "project_assignments_member_id_start_date_end_date_idx" ON "project_assignments"("member_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "project_positions_project_id_idx" ON "project_positions"("project_id");

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_company_idx" ON "projects"("company");

-- CreateIndex
CREATE INDEX "projects_deleted_at_idx" ON "projects"("deleted_at");

-- CreateIndex
CREATE INDEX "skills_category_id_idx" ON "skills"("category_id");

-- CreateIndex
CREATE INDEX "work_schedules_date_idx" ON "work_schedules"("date");

-- AddForeignKey
ALTER TABLE "intra_company_settlements" ADD CONSTRAINT "intra_company_settlements_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
