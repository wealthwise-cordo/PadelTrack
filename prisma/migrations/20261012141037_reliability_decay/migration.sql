-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "lastRankedPlayedAt" TIMESTAMP(3),
ALTER COLUMN "reliability" SET DEFAULT 0.01;
