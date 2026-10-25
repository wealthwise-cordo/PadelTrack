-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "incomplete" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "winner" DROP NOT NULL;

