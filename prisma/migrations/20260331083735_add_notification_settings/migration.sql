-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "clock_reminder" BOOLEAN NOT NULL DEFAULT true,
    "closing_reminder" BOOLEAN NOT NULL DEFAULT true,
    "schedule_reminder" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_member_id_key" ON "notification_settings"("member_id");

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
