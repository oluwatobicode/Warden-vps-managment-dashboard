/*
  Warnings:

  - Made the column `dataKeyWrapped` on table `Organization` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "dataKeyWrapped" SET NOT NULL;
