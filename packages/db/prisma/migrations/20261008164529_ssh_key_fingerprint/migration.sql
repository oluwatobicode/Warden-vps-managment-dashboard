/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,sshKeyName]` on the table `SshKey` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fingerprint` to the `SshKey` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SshKey" ADD COLUMN     "fingerprint" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SshKey_organizationId_sshKeyName_key" ON "SshKey"("organizationId", "sshKeyName");
