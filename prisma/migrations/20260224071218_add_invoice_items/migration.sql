/*
  Warnings:

  - You are about to drop the column `company` on the `members` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "member_contracts" ADD COLUMN     "docusign_template_id" VARCHAR(100),
ADD COLUMN     "envelope_id" VARCHAR(100);

-- AlterTable
ALTER TABLE "members" DROP COLUMN "company";

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "amount" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
