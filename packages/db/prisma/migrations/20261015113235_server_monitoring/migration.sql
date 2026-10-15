-- CreateEnum
CREATE TYPE "CleanupStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED');

-- DropIndex
DROP INDEX "ServerContainer_serverId_createdAt_idx";

-- AlterTable
ALTER TABLE "DockerCleanupLog" DROP COLUMN "success",
ADD COLUMN     "finishedAt" TIMESTAMP(3),
ADD COLUMN     "reclaimedBytes" DOUBLE PRECISION,
ADD COLUMN     "status" "CleanupStatus" NOT NULL DEFAULT 'QUEUED',
ADD COLUMN     "triggeredById" TEXT;

-- AlterTable
ALTER TABLE "ServerContainer" DROP COLUMN "containerStatus",
DROP COLUMN "lastUsedAt",
ADD COLUMN     "containerMemoryLimit" DOUBLE PRECISION,
ADD COLUMN     "dockerId" TEXT NOT NULL,
ADD COLUMN     "health" TEXT,
ADD COLUMN     "image" TEXT NOT NULL,
ADD COLUMN     "state" TEXT NOT NULL,
ADD COLUMN     "statusText" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "containerCpuUsage" DROP NOT NULL,
ALTER COLUMN "containerMemoryUsage" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ServerMetrics" ADD COLUMN     "diskTotalBytes" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "diskUsedBytes" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "load1" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "load15" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "load5" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "memoryTotalBytes" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "memoryUsedBytes" DOUBLE PRECISION NOT NULL;

-- CreateIndex
CREATE INDEX "DockerCleanupLog_triggeredById_idx" ON "DockerCleanupLog"("triggeredById");

-- CreateIndex
CREATE UNIQUE INDEX "ServerContainer_serverId_dockerId_key" ON "ServerContainer"("serverId", "dockerId");

-- AddForeignKey
ALTER TABLE "DockerCleanupLog" ADD CONSTRAINT "DockerCleanupLog_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

