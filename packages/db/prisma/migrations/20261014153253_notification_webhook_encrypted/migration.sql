/*
  Warnings:

  - You are about to drop the column `webhookUrl` on the `NotificationChannel` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[organizationId,name]` on the table `NotificationChannel` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "NotificationChannel" DROP COLUMN "webhookUrl",
ADD COLUMN     "webhookUrlEncrypted" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "NotificationChannel_organizationId_name_key" ON "NotificationChannel"("organizationId", "name");
