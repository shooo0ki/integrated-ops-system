-- AlterTable
ALTER TABLE "project_assignments" ADD COLUMN     "allocation_rate" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "project_positions" ADD COLUMN     "headcount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "weekly_hours" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "project_position_masters" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "project_position_masters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_position_masters_name_key" ON "project_position_masters"("name");
