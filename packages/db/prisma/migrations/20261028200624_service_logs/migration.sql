-- Trigram search for ServiceLog.message (ILIKE %text%). pg_trgm ships with
-- Postgres and is a trusted extension, so the database owner can create it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "LogStream" AS ENUM ('STDOUT', 'STDERR', 'WARDEN');

-- CreateTable
CREATE TABLE "ServiceLog" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "deploymentId" TEXT,
    "stream" "LogStream" NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,

    CONSTRAINT "ServiceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceLog_serviceId_ts_idx" ON "ServiceLog"("serviceId", "ts");

-- CreateIndex
CREATE INDEX "ServiceLog_ts_idx" ON "ServiceLog"("ts");

-- CreateIndex
CREATE INDEX "ServiceLog_message_idx" ON "ServiceLog" USING GIN ("message" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "ServiceLog" ADD CONSTRAINT "ServiceLog_serviceId_organizationId_fkey" FOREIGN KEY ("serviceId", "organizationId") REFERENCES "Service"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
