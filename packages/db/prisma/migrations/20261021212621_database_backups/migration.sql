-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "BackupTrigger" AS ENUM ('SCHEDULED', 'MANUAL');

-- CreateEnum
CREATE TYPE "BackupStorageKind" AS ENUM ('PLATFORM', 'ORG');

-- CreateTable
CREATE TABLE "BackupStorage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "accessKeyId" TEXT NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupStorage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatabaseBackup" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "BackupStatus" NOT NULL DEFAULT 'QUEUED',
    "trigger" "BackupTrigger" NOT NULL,
    "storage" "BackupStorageKind" NOT NULL,
    "bucket" TEXT,
    "objectKey" TEXT,
    "sizeBytes" DOUBLE PRECISION,
    "iv" TEXT,
    "authTag" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatabaseBackup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BackupStorage_organizationId_key" ON "BackupStorage"("organizationId");

-- CreateIndex
CREATE INDEX "DatabaseBackup_serviceId_createdAt_idx" ON "DatabaseBackup"("serviceId", "createdAt");

-- CreateIndex
CREATE INDEX "DatabaseBackup_organizationId_idx" ON "DatabaseBackup"("organizationId");

-- AddForeignKey
ALTER TABLE "BackupStorage" ADD CONSTRAINT "BackupStorage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatabaseBackup" ADD CONSTRAINT "DatabaseBackup_serviceId_organizationId_fkey" FOREIGN KEY ("serviceId", "organizationId") REFERENCES "ServiceDatabase"("serviceId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatabaseBackup" ADD CONSTRAINT "DatabaseBackup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

