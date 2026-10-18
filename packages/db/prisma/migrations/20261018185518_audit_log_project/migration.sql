-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_projectId_createdAt_idx" ON "AuditLog"("organizationId", "projectId", "createdAt");

