/*
  Warnings:

  - You are about to drop the `attendance_allocations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `intra_company_settlements` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "attendance_allocations" DROP CONSTRAINT "attendance_allocations_attendance_id_fkey";

-- DropForeignKey
ALTER TABLE "attendance_allocations" DROP CONSTRAINT "attendance_allocations_project_id_fkey";

-- DropForeignKey
ALTER TABLE "intra_company_settlements" DROP CONSTRAINT "intra_company_settlements_member_id_fkey";

-- DropTable
DROP TABLE "attendance_allocations";

-- DropTable
DROP TABLE "intra_company_settlements";

-- DropEnum
DROP TYPE "SettlementBasis";
