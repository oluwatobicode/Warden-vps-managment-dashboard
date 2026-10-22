-- AlterTable
ALTER TABLE "Environment" ADD COLUMN     "defaultServerId" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "staticOutputDir" TEXT;

-- CreateIndex
CREATE INDEX "Environment_defaultServerId_organizationId_idx" ON "Environment"("defaultServerId", "organizationId");

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_defaultServerId_organizationId_fkey" FOREIGN KEY ("defaultServerId", "organizationId") REFERENCES "Server"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

