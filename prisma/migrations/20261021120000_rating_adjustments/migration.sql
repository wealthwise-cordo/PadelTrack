-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'member';

-- AlterTable
ALTER TABLE "PTRHistory" ADD COLUMN     "adjustmentId" TEXT,
ALTER COLUMN "matchId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "RatingAdjustment" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "requestedById" TEXT,
    "delta" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "ptrAtRequest" DOUBLE PRECISION NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RatingAdjustment_status_createdAt_idx" ON "RatingAdjustment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RatingAdjustment_playerId_idx" ON "RatingAdjustment"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "PTRHistory_adjustmentId_key" ON "PTRHistory"("adjustmentId");

-- AddForeignKey
ALTER TABLE "PTRHistory" ADD CONSTRAINT "PTRHistory_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "RatingAdjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingAdjustment" ADD CONSTRAINT "RatingAdjustment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingAdjustment" ADD CONSTRAINT "RatingAdjustment_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingAdjustment" ADD CONSTRAINT "RatingAdjustment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The owner is the super user.
UPDATE "User" SET "role" = 'superuser' WHERE lower("email") = 'cordvaneck@gmail.com';
