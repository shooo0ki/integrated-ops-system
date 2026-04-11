/*
  Warnings:

  - A unique constraint covering the columns `[user_id,provider_id]` on the table `ba_account` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "ba_account_account_id_provider_id_idx" ON "ba_account"("account_id", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "ba_account_user_id_provider_id_key" ON "ba_account"("user_id", "provider_id");
