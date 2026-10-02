/*
  Warnings:

  - The values [DEPLOYER] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
-- Data step (hand-written): Postgres can't cast a value the new type lacks, so
-- remap every DEPLOYER row to DEVELOPER first. "Can deploy" is now a DEVELOPER permission.
UPDATE "Membership" SET "role" = 'DEVELOPER' WHERE "role" = 'DEPLOYER';
UPDATE "Invitation" SET "role" = 'DEVELOPER' WHERE "role" = 'DEPLOYER';
UPDATE "AuditLog"   SET "performedByRole" = 'DEVELOPER' WHERE "performedByRole" = 'DEPLOYER';

CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'DEVELOPER', 'DEV_OPS', 'VIEWER');
ALTER TABLE "public"."Invitation" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "public"."Membership" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Invitation" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TABLE "Membership" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TABLE "AuditLog" ALTER COLUMN "performedByRole" TYPE "Role_new" USING ("performedByRole"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "Invitation" ALTER COLUMN "role" SET DEFAULT 'VIEWER';
ALTER TABLE "Membership" ALTER COLUMN "role" SET DEFAULT 'VIEWER';
COMMIT;
