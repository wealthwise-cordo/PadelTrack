-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "joinToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Match_joinToken_key" ON "Match"("joinToken");
