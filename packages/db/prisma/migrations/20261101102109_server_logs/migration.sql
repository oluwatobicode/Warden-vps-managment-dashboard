/*
  Warnings:

  - You are about to drop the `ServerLogs` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ServerLogSource" AS ENUM ('TRAEFIK', 'DOCKER', 'SYSTEM', 'WARDEN');

-- DropForeignKey
ALTER TABLE "ServerLogs" DROP CONSTRAINT "ServerLogs_serverId_fkey";

-- DropTable
DROP TABLE "ServerLogs";

-- CreateTable
CREATE TABLE "ServerLog" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "source" "ServerLogSource" NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,

    CONSTRAINT "ServerLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServerLog_serverId_ts_idx" ON "ServerLog"("serverId", "ts");

-- CreateIndex
CREATE INDEX "ServerLog_ts_idx" ON "ServerLog"("ts");

-- CreateIndex
CREATE INDEX "ServerLog_message_idx" ON "ServerLog" USING GIN ("message" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "ServerLog" ADD CONSTRAINT "ServerLog_serverId_organizationId_fkey" FOREIGN KEY ("serverId", "organizationId") REFERENCES "Server"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
