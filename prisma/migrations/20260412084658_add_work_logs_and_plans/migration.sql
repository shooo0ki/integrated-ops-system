-- CreateTable
CREATE TABLE "schedule_work_plans" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "project_id" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "note" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_work_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_work_logs" (
    "id" TEXT NOT NULL,
    "attendance_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "note" VARCHAR(200),

    CONSTRAINT "attendance_work_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_work_plans_member_id_week_start_idx" ON "schedule_work_plans"("member_id", "week_start");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_work_plans_member_id_week_start_project_id_key" ON "schedule_work_plans"("member_id", "week_start", "project_id");

-- CreateIndex
CREATE INDEX "attendance_work_logs_attendance_id_idx" ON "attendance_work_logs"("attendance_id");

-- CreateIndex
CREATE INDEX "attendance_work_logs_project_id_idx" ON "attendance_work_logs"("project_id");

-- AddForeignKey
ALTER TABLE "schedule_work_plans" ADD CONSTRAINT "schedule_work_plans_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_work_plans" ADD CONSTRAINT "schedule_work_plans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_work_logs" ADD CONSTRAINT "attendance_work_logs_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_work_logs" ADD CONSTRAINT "attendance_work_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
