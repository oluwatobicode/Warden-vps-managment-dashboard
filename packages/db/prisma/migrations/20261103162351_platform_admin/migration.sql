-- CreateTable
CREATE TABLE "OrganizationTombstone" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orgCreatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberCount" INTEGER NOT NULL,
    "serverCount" INTEGER NOT NULL,
    "deployCount" INTEGER NOT NULL,
    "everDeployedOk" BOOLEAN NOT NULL,

    CONSTRAINT "OrganizationTombstone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationTombstone_deletedAt_idx" ON "OrganizationTombstone"("deletedAt");
