-- CreateIndex
CREATE INDEX "members_deleted_at_left_at_idx" ON "members"("deleted_at", "left_at");

-- CreateIndex
CREATE INDEX "monthly_self_reports_target_month_idx" ON "monthly_self_reports"("target_month");

-- CreateIndex
CREATE INDEX "project_assignments_project_id_start_date_idx" ON "project_assignments"("project_id", "start_date");

-- CreateIndex
CREATE INDEX "projects_status_deleted_at_idx" ON "projects"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "work_schedules_member_id_is_off_date_idx" ON "work_schedules"("member_id", "is_off", "date");
