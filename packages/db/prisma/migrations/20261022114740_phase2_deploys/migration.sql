-- CreateEnum
CREATE TYPE "BuildMethod" AS ENUM ('DOCKERFILE', 'RAILPACK');

-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "buildMethod" "BuildMethod",
ADD COLUMN     "containerName" TEXT,
ADD COLUMN     "imageTag" TEXT,
ADD COLUMN     "rollbackOfId" TEXT;

-- AlterTable
ALTER TABLE "Server" ADD COLUMN     "proxyInstalledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "autoDeploy" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "buildCommand" TEXT,
ADD COLUMN     "dockerfilePath" TEXT NOT NULL DEFAULT 'Dockerfile',
ADD COLUMN     "githubInstallationId" TEXT,
ADD COLUMN     "githubRepoId" INTEGER,
ADD COLUMN     "healthCheckPath" TEXT NOT NULL DEFAULT '/',
ADD COLUMN     "releaseCommand" TEXT,
ADD COLUMN     "rootDirectory" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "startCommand" TEXT,
ADD COLUMN     "watchPaths" TEXT[];

-- CreateTable
CREATE TABLE "DeploymentLog" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeploymentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubInstallation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "installationId" INTEGER NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GithubInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceDomain" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeploymentLog_createdAt_idx" ON "DeploymentLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentLog_deploymentId_seq_key" ON "DeploymentLog"("deploymentId", "seq");

-- CreateIndex
CREATE INDEX "GithubInstallation_installationId_idx" ON "GithubInstallation"("installationId");

-- CreateIndex
CREATE UNIQUE INDEX "GithubInstallation_organizationId_installationId_key" ON "GithubInstallation"("organizationId", "installationId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceDomain_domain_key" ON "ServiceDomain"("domain");

-- CreateIndex
CREATE INDEX "ServiceDomain_serviceId_organizationId_idx" ON "ServiceDomain"("serviceId", "organizationId");

-- CreateIndex
CREATE INDEX "Deployment_rollbackOfId_idx" ON "Deployment"("rollbackOfId");

-- CreateIndex
CREATE INDEX "Service_githubInstallationId_idx" ON "Service"("githubInstallationId");

-- CreateIndex
CREATE INDEX "Service_githubRepoId_idx" ON "Service"("githubRepoId");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_githubInstallationId_fkey" FOREIGN KEY ("githubInstallationId") REFERENCES "GithubInstallation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_rollbackOfId_fkey" FOREIGN KEY ("rollbackOfId") REFERENCES "Deployment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentLog" ADD CONSTRAINT "DeploymentLog_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubInstallation" ADD CONSTRAINT "GithubInstallation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceDomain" ADD CONSTRAINT "ServiceDomain_serviceId_organizationId_fkey" FOREIGN KEY ("serviceId", "organizationId") REFERENCES "Service"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

