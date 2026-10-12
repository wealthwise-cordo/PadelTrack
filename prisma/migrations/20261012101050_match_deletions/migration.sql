-- CreateTable
CREATE TABLE "MatchDeletion" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "wasPending" BOOLEAN NOT NULL,
    "wasRanked" BOOLEAN NOT NULL,
    "byRecorder" BOOLEAN NOT NULL,
    "matchSubmittedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchDeletion_createdAt_idx" ON "MatchDeletion"("createdAt");
