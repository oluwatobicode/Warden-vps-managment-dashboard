-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('APPLICATION', 'WORKER', 'DATABASE', 'COMPOSE');

-- AlterEnum
BEGIN;
CREATE TYPE "DeploymentStatus_new" AS ENUM ('QUEUED', 'BUILDING', 'DEPLOYING', 'HEALTH_CHECK', 'SUCCESS', 'GATE_FAILED', 'ROLLED_BACK', 'FAILED', 'CANCELLED');
ALTER TABLE "public"."Deployment" ALTER COLUMN "deploymentStatus" DROP DEFAULT;
ALTER TABLE "Deployment" ALTER COLUMN "deploymentStatus" TYPE "DeploymentStatus_new" USING ("deploymentStatus"::text::"DeploymentStatus_new");
ALTER TABLE "DeploymentHistory" ALTER COLUMN "status" TYPE "DeploymentStatus_new" USING ("status"::text::"DeploymentStatus_new");
ALTER TYPE "DeploymentStatus" RENAME TO "DeploymentStatus_old";
ALTER TYPE "DeploymentStatus_new" RENAME TO "DeploymentStatus";
DROP TYPE "public"."DeploymentStatus_old";
ALTER TABLE "Deployment" ALTER COLUMN "deploymentStatus" SET DEFAULT 'QUEUED';
COMMIT;

-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "number" INTEGER NOT NULL,
ADD COLUMN     "organizationId" TEXT NOT NULL,
ALTER COLUMN "deploymentStatus" SET DEFAULT 'QUEUED';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "deployCounter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "slug" TEXT;

-- Backfill: existing orgs get slug(name) + 6 chars of their id, then enforce NOT NULL.
-- New orgs get a slug from the app at onboarding.
UPDATE "Organization"
SET "slug" = trim(both '-' from lower(regexp_replace("organizationName", '[^a-zA-Z0-9]+', '-', 'g'))) || '-' || substr(md5(id), 1, 6);
ALTER TABLE "Organization" ALTER COLUMN "slug" SET NOT NULL;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "githubRepoUrl";

-- AlterTable
ALTER TABLE "Server" ADD COLUMN     "provider" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "branch" TEXT,
ADD COLUMN     "githubRepoUrl" TEXT,
ADD COLUMN     "type" "ServiceType" NOT NULL DEFAULT 'APPLICATION';

-- CreateTable
CREATE TABLE "EnvironmentVariable" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueEncrypted" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT true,
    "environmentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceVariable" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueEncrypted" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT true,
    "serviceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceVariable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnvironmentVariable_organizationId_idx" ON "EnvironmentVariable"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentVariable_environmentId_key_key" ON "EnvironmentVariable"("environmentId", "key");

-- CreateIndex
CREATE INDEX "ServiceVariable_organizationId_idx" ON "ServiceVariable"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceVariable_serviceId_key_key" ON "ServiceVariable"("serviceId", "key");

-- CreateIndex
CREATE INDEX "Deployment_organizationId_createdAt_idx" ON "Deployment"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Deployment_organizationId_number_key" ON "Deployment"("organizationId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Service_id_organizationId_key" ON "Service"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "EnvironmentVariable" ADD CONSTRAINT "EnvironmentVariable_environmentId_organizationId_fkey" FOREIGN KEY ("environmentId", "organizationId") REFERENCES "Environment"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVariable" ADD CONSTRAINT "ServiceVariable_serviceId_organizationId_fkey" FOREIGN KEY ("serviceId", "organizationId") REFERENCES "Service"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

