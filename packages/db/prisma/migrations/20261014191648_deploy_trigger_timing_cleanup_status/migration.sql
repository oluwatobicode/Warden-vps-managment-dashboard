-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "commitMessage" TEXT,
ADD COLUMN     "finishedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "triggeredById" TEXT,
ADD COLUMN     "triggeredByName" TEXT;

-- AlterTable
ALTER TABLE "DockerCleanupLog" ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "success" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Deployment_triggeredById_idx" ON "Deployment"("triggeredById");

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
