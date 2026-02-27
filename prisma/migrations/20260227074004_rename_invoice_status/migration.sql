/*
  Warnings:

  - You are about to drop the column `slack_sent_status` on the `invoices` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('unsent', 'sent', 'confirmed');

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "slack_sent_status",
ADD COLUMN     "status" "InvoiceStatus" NOT NULL DEFAULT 'unsent';

-- DropEnum
DROP TYPE "SlackSentStatus";
