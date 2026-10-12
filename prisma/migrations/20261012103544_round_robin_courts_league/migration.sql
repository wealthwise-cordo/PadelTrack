-- AlterTable
ALTER TABLE "RoundRobinEvent" ADD COLUMN     "courts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "league" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RoundRobinMatch" ADD COLUMN     "court" INTEGER;
