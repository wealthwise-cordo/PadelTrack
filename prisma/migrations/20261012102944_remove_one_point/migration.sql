/*
  Warnings:

  - You are about to drop the `OnePointEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OnePointMatch` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "OnePointEvent" DROP CONSTRAINT "OnePointEvent_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "OnePointMatch" DROP CONSTRAINT "OnePointMatch_eventId_fkey";

-- DropTable
DROP TABLE "OnePointEvent";

-- DropTable
DROP TABLE "OnePointMatch";
