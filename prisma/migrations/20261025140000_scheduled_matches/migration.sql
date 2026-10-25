-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "disputeRemindedAt" TIMESTAMP(3),
ADD COLUMN     "disputed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "organiserId" TEXT,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "scorePromptSentAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "MatchScoreReport" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "sets" JSONB NOT NULL,
    "winner" TEXT,
    "incomplete" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchScoreReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchScoreReport_matchId_idx" ON "MatchScoreReport"("matchId");

-- CreateIndex
CREATE INDEX "Match_status_playedAt_idx" ON "Match"("status", "playedAt");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchScoreReport" ADD CONSTRAINT "MatchScoreReport_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchScoreReport" ADD CONSTRAINT "MatchScoreReport_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

