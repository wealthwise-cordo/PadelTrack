-- AlterTable
ALTER TABLE "AmericanoEvent" ADD COLUMN     "courts" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "AmericanoMatch" ADD COLUMN     "court" INTEGER;
