-- CreateEnum
CREATE TYPE "ProxyConfigStatus" AS ENUM ('APPLIED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "ProxyConfigSource" AS ENUM ('FORM', 'RAW', 'REVERT');

-- AlterTable
ALTER TABLE "Server" ADD COLUMN     "proxyRevision" INTEGER;

-- AlterTable
ALTER TABLE "ServerTraefik" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "createdByName" TEXT,
ADD COLUMN     "form" JSONB,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "problems" JSONB,
ADD COLUMN     "raw" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "source" "ProxyConfigSource" NOT NULL DEFAULT 'RAW',
ADD COLUMN     "status" "ProxyConfigStatus" NOT NULL DEFAULT 'APPLIED';

-- CreateIndex
CREATE INDEX "ServerTraefik_createdById_idx" ON "ServerTraefik"("createdById");

-- AddForeignKey
ALTER TABLE "ServerTraefik" ADD CONSTRAINT "ServerTraefik_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

