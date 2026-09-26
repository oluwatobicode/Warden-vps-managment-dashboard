/*
  Warnings:

  - A unique constraint covering the columns `[id,organizationId]` on the table `ApiToken` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_id_organizationId_key" ON "ApiToken"("id", "organizationId");
