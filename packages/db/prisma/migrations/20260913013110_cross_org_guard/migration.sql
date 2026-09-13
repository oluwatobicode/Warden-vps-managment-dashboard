-- DropForeignKey
ALTER TABLE "ApiToken" DROP CONSTRAINT "ApiToken_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Environment" DROP CONSTRAINT "Environment_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Server" DROP CONSTRAINT "Server_serverSshKeyId_fkey";

-- DropForeignKey
ALTER TABLE "Service" DROP CONSTRAINT "Service_environmentId_fkey";

-- DropForeignKey
ALTER TABLE "Service" DROP CONSTRAINT "Service_serverId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_organizationId_fkey";

-- DropIndex
DROP INDEX "User_organizationId_idx";

-- AlterTable
ALTER TABLE "Environment" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "organizationId";

-- CreateIndex
CREATE INDEX "Environment_organizationId_idx" ON "Environment"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Environment_id_organizationId_key" ON "Environment"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_id_organizationId_key" ON "Project"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Server_id_organizationId_key" ON "Server"("id", "organizationId");

-- CreateIndex
CREATE INDEX "Service_organizationId_idx" ON "Service"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SshKey_id_organizationId_key" ON "SshKey"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_projectId_organizationId_fkey" FOREIGN KEY ("projectId", "organizationId") REFERENCES "Project"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_environmentId_organizationId_fkey" FOREIGN KEY ("environmentId", "organizationId") REFERENCES "Environment"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_serverId_organizationId_fkey" FOREIGN KEY ("serverId", "organizationId") REFERENCES "Server"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_serverSshKeyId_organizationId_fkey" FOREIGN KEY ("serverSshKeyId", "organizationId") REFERENCES "SshKey"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_projectId_organizationId_fkey" FOREIGN KEY ("projectId", "organizationId") REFERENCES "Project"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

