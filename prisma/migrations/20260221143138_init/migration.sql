-- CreateTable
CREATE TABLE "user_accounts" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "member_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "profile_image_url" TEXT,
    "phone" VARCHAR(20),
    "address" TEXT,
    "status" VARCHAR(30) NOT NULL,
    "company" VARCHAR(10) NOT NULL,
    "salary_type" VARCHAR(10) NOT NULL,
    "salary_amount" INTEGER NOT NULL,
    "bank_name" TEXT,
    "bank_branch" TEXT,
    "bank_account_number" TEXT,
    "bank_account_holder" TEXT,
    "joined_at" DATE NOT NULL,
    "left_at" DATE,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_categories" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "display_order" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(200),
    "display_order" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_skills" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "evaluated_at" DATE NOT NULL,
    "memo" VARCHAR(500),
    "evaluated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL,
    "company" VARCHAR(10) NOT NULL,
    "project_type" VARCHAR(20) NOT NULL DEFAULT 'salt2_own',
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "client_name" VARCHAR(200),
    "contract_type" VARCHAR(20),
    "monthly_contract_amount" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_positions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "position_name" VARCHAR(100) NOT NULL,
    "required_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_required_skills" (
    "id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "min_level" INTEGER NOT NULL,

    CONSTRAINT "position_required_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_assignments" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "position_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "workload_hours" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedules" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "start_time" VARCHAR(5),
    "end_time" VARCHAR(5),
    "is_off" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "clock_in" TIMESTAMP(3),
    "clock_out" TIMESTAMP(3),
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "work_minutes" INTEGER,
    "todo_today" VARCHAR(500),
    "done_today" VARCHAR(500),
    "todo_tomorrow" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "confirm_status" VARCHAR(20) NOT NULL DEFAULT 'unconfirmed',
    "slack_notified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" VARCHAR(20) NOT NULL,
    "member_id" TEXT NOT NULL,
    "target_month" CHAR(7) NOT NULL,
    "work_hours_total" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "unit_price" INTEGER NOT NULL,
    "amount_excl_tax" INTEGER NOT NULL DEFAULT 0,
    "amount_incl_tax" INTEGER NOT NULL DEFAULT 0,
    "amount_boost" INTEGER NOT NULL DEFAULT 0,
    "amount_salt2" INTEGER NOT NULL DEFAULT 0,
    "file_path" TEXT,
    "slack_sent_status" VARCHAR(10) NOT NULL DEFAULT 'unsent',
    "issued_at" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pl_records" (
    "id" TEXT NOT NULL,
    "record_type" VARCHAR(5) NOT NULL,
    "project_id" TEXT,
    "target_month" CHAR(7) NOT NULL,
    "revenue_contract" INTEGER NOT NULL DEFAULT 0,
    "revenue_extra" INTEGER NOT NULL DEFAULT 0,
    "cost_labor_monthly" INTEGER NOT NULL DEFAULT 0,
    "cost_labor_hourly" INTEGER NOT NULL DEFAULT 0,
    "cost_outsourcing" INTEGER NOT NULL DEFAULT 0,
    "cost_tools" INTEGER NOT NULL DEFAULT 0,
    "cost_other" INTEGER NOT NULL DEFAULT 0,
    "gross_profit" INTEGER NOT NULL DEFAULT 0,
    "gross_profit_rate" DECIMAL(5,2),
    "markup_rate" DECIMAL(5,3),
    "cf_cash_in_client" INTEGER NOT NULL DEFAULT 0,
    "cf_cash_in_other" INTEGER NOT NULL DEFAULT 0,
    "cf_cash_out_salary" INTEGER NOT NULL DEFAULT 0,
    "cf_cash_out_outsourcing" INTEGER NOT NULL DEFAULT 0,
    "cf_cash_out_fixed" INTEGER NOT NULL DEFAULT 0,
    "cf_cash_out_other" INTEGER NOT NULL DEFAULT 0,
    "cf_balance_prev" INTEGER,
    "cf_balance_current" INTEGER NOT NULL DEFAULT 0,
    "memo" VARCHAR(200),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pl_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_tools" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "tool_name" VARCHAR(100) NOT NULL,
    "plan" VARCHAR(50),
    "monthly_cost" INTEGER NOT NULL DEFAULT 0,
    "company_label" VARCHAR(10) NOT NULL,
    "note" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_contracts" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "template_name" VARCHAR(100) NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "file_url" TEXT,
    "file_hash" VARCHAR(128),
    "signer_email" VARCHAR(255) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "target_table" VARCHAR(100) NOT NULL,
    "target_id" TEXT NOT NULL,
    "action" VARCHAR(10) NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB,
    "ip_address" VARCHAR(45) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_allocations" (
    "id" TEXT NOT NULL,
    "attendance_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intra_company_settlements" (
    "id" TEXT NOT NULL,
    "target_month" DATE NOT NULL,
    "paying_company" VARCHAR(10) NOT NULL,
    "receiving_company" VARCHAR(10) NOT NULL,
    "member_id" TEXT,
    "amount" INTEGER NOT NULL,
    "basis" VARCHAR(20) NOT NULL DEFAULT 'allocation',
    "note" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intra_company_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_self_reports" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "target_month" CHAR(7) NOT NULL,
    "project_id" TEXT NOT NULL,
    "reported_hours" DECIMAL(6,2) NOT NULL,
    "note" VARCHAR(500),
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_self_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_accounts_email_key" ON "user_accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_accounts_member_id_key" ON "user_accounts"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_categories_name_key" ON "skill_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "skills_category_id_name_key" ON "skills"("category_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "position_required_skills_position_id_skill_id_key" ON "position_required_skills"("position_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_schedules_member_id_date_key" ON "work_schedules"("member_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_member_id_date_key" ON "attendances"("member_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_member_id_target_month_key" ON "invoices"("member_id", "target_month");

-- CreateIndex
CREATE UNIQUE INDEX "pl_records_project_id_target_month_record_type_key" ON "pl_records"("project_id", "target_month", "record_type");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_allocations_attendance_id_project_id_key" ON "attendance_allocations"("attendance_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_self_reports_member_id_target_month_project_id_key" ON "monthly_self_reports"("member_id", "target_month", "project_id");

-- AddForeignKey
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "skill_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_skills" ADD CONSTRAINT "member_skills_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_skills" ADD CONSTRAINT "member_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_skills" ADD CONSTRAINT "member_skills_evaluated_by_fkey" FOREIGN KEY ("evaluated_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_positions" ADD CONSTRAINT "project_positions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_required_skills" ADD CONSTRAINT "position_required_skills_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "project_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_required_skills" ADD CONSTRAINT "position_required_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "project_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pl_records" ADD CONSTRAINT "pl_records_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pl_records" ADD CONSTRAINT "pl_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_tools" ADD CONSTRAINT "member_tools_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_contracts" ADD CONSTRAINT "member_contracts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_configs" ADD CONSTRAINT "system_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_allocations" ADD CONSTRAINT "attendance_allocations_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_allocations" ADD CONSTRAINT "attendance_allocations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_self_reports" ADD CONSTRAINT "monthly_self_reports_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_self_reports" ADD CONSTRAINT "monthly_self_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
