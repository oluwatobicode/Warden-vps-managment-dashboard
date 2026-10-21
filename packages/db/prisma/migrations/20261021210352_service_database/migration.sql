-- CreateEnum
CREATE TYPE "DatabaseEngine" AS ENUM ('POSTGRES', 'MYSQL', 'REDIS');

-- CreateTable
CREATE TABLE "ServiceDatabase" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "engine" "DatabaseEngine" NOT NULL,
    "version" TEXT NOT NULL,
    "databaseName" TEXT,
    "username" TEXT,
    "passwordEncrypted" TEXT NOT NULL,
    "rootPasswordEncrypted" TEXT,
    "containerName" TEXT NOT NULL,
    "volumeName" TEXT NOT NULL,
    "networkName" TEXT NOT NULL,
    "variableName" TEXT NOT NULL,
    "environmentVariableId" TEXT,
    "backupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "backupHourUtc" INTEGER NOT NULL DEFAULT 2,
    "backupRetentionDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceDatabase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceDatabase_serviceId_key" ON "ServiceDatabase"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceDatabase_organizationId_idx" ON "ServiceDatabase"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceDatabase_serviceId_organizationId_key" ON "ServiceDatabase"("serviceId", "organizationId");

-- AddForeignKey
ALTER TABLE "ServiceDatabase" ADD CONSTRAINT "ServiceDatabase_serviceId_organizationId_fkey" FOREIGN KEY ("serviceId", "organizationId") REFERENCES "Service"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceDatabase" ADD CONSTRAINT "ServiceDatabase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

