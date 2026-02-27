-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "location_type" VARCHAR(20) NOT NULL DEFAULT 'office';

-- AlterTable
ALTER TABLE "work_schedules" ADD COLUMN     "location_type" VARCHAR(20) NOT NULL DEFAULT 'office';
