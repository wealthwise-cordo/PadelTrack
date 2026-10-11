-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "avatarColor" TEXT NOT NULL DEFAULT '#f97316',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,
    "createdById" TEXT,
    "claimToken" TEXT,
    "ptr" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "reliability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "setsWon" INTEGER NOT NULL DEFAULT 0,
    "setsLost" INTEGER NOT NULL DEFAULT 0,
    "gamesWon" INTEGER NOT NULL DEFAULT 0,
    "gamesLost" INTEGER NOT NULL DEFAULT 0,
    "tiebreaksWon" INTEGER NOT NULL DEFAULT 0,
    "tiebreaksPlayed" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "autoConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "scoreConfirmedAt" TIMESTAMP(3),
    "becameFriendly" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "isRanked" BOOLEAN NOT NULL DEFAULT true,
    "winner" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "teamAPlayer1Id" TEXT NOT NULL,
    "teamAPlayer2Id" TEXT NOT NULL,
    "teamBPlayer1Id" TEXT NOT NULL,
    "teamBPlayer2Id" TEXT NOT NULL,
    "teamAPTRBefore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "teamBPTRBefore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "teamAPTRAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "teamBPTRAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ptrDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scoreMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isUpset" BOOLEAN NOT NULL DEFAULT false,
    "matchQuality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "location" TEXT,
    "notes" TEXT,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchSet" (
    "matchId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "teamAGames" INTEGER NOT NULL,
    "teamBGames" INTEGER NOT NULL,

    CONSTRAINT "MatchSet_pkey" PRIMARY KEY ("matchId","setNumber")
);

-- CreateTable
CREATE TABLE "PTRHistory" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "ptrBefore" DOUBLE PRECISION NOT NULL,
    "ptrAfter" DOUBLE PRECISION NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "reliability" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PTRHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmericanoEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "scoreMode" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "playerIds" TEXT[],

    CONSTRAINT "AmericanoEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmericanoMatch" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "teamAPlayer1Id" TEXT NOT NULL,
    "teamAPlayer2Id" TEXT NOT NULL,
    "teamBPlayer1Id" TEXT NOT NULL,
    "teamBPlayer2Id" TEXT NOT NULL,
    "teamAScore" INTEGER,
    "teamBScore" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "AmericanoMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundRobinEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "target" INTEGER NOT NULL,
    "teamPlayerIds" TEXT[],

    CONSTRAINT "RoundRobinEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundRobinMatch" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "teamAPlayer1Id" TEXT NOT NULL,
    "teamAPlayer2Id" TEXT NOT NULL,
    "teamBPlayer1Id" TEXT NOT NULL,
    "teamBPlayer2Id" TEXT NOT NULL,
    "teamAScore" INTEGER,
    "teamBScore" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "RoundRobinMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnePointEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "playerIds" TEXT[],

    CONSTRAINT "OnePointEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnePointMatch" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "player1Id" TEXT,
    "player2Id" TEXT,
    "winnerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "OnePointMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnakeLaddersEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "scoreMode" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "totalRounds" INTEGER NOT NULL,
    "playerIds" TEXT[],

    CONSTRAINT "SnakeLaddersEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnakeLaddersMatch" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "court" TEXT NOT NULL,
    "teamAPlayer1Id" TEXT NOT NULL,
    "teamAPlayer2Id" TEXT NOT NULL,
    "teamBPlayer1Id" TEXT NOT NULL,
    "teamBPlayer2Id" TEXT NOT NULL,
    "teamAScore" INTEGER,
    "teamBScore" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "SnakeLaddersMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Player_userId_key" ON "Player"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_claimToken_key" ON "Player"("claimToken");

-- CreateIndex
CREATE INDEX "Player_createdById_idx" ON "Player"("createdById");

-- CreateIndex
CREATE INDEX "Match_teamAPlayer1Id_idx" ON "Match"("teamAPlayer1Id");

-- CreateIndex
CREATE INDEX "Match_teamAPlayer2Id_idx" ON "Match"("teamAPlayer2Id");

-- CreateIndex
CREATE INDEX "Match_teamBPlayer1Id_idx" ON "Match"("teamBPlayer1Id");

-- CreateIndex
CREATE INDEX "Match_teamBPlayer2Id_idx" ON "Match"("teamBPlayer2Id");

-- CreateIndex
CREATE INDEX "Match_status_submittedAt_idx" ON "Match"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "PTRHistory_playerId_idx" ON "PTRHistory"("playerId");

-- CreateIndex
CREATE INDEX "AmericanoEvent_ownerId_idx" ON "AmericanoEvent"("ownerId");

-- CreateIndex
CREATE INDEX "AmericanoMatch_eventId_idx" ON "AmericanoMatch"("eventId");

-- CreateIndex
CREATE INDEX "RoundRobinEvent_ownerId_idx" ON "RoundRobinEvent"("ownerId");

-- CreateIndex
CREATE INDEX "RoundRobinMatch_eventId_idx" ON "RoundRobinMatch"("eventId");

-- CreateIndex
CREATE INDEX "OnePointEvent_ownerId_idx" ON "OnePointEvent"("ownerId");

-- CreateIndex
CREATE INDEX "OnePointMatch_eventId_idx" ON "OnePointMatch"("eventId");

-- CreateIndex
CREATE INDEX "SnakeLaddersEvent_ownerId_idx" ON "SnakeLaddersEvent"("ownerId");

-- CreateIndex
CREATE INDEX "SnakeLaddersMatch_eventId_idx" ON "SnakeLaddersMatch"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "SnakeLaddersMatch_eventId_round_court_key" ON "SnakeLaddersMatch"("eventId", "round", "court");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamAPlayer1Id_fkey" FOREIGN KEY ("teamAPlayer1Id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamAPlayer2Id_fkey" FOREIGN KEY ("teamAPlayer2Id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamBPlayer1Id_fkey" FOREIGN KEY ("teamBPlayer1Id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamBPlayer2Id_fkey" FOREIGN KEY ("teamBPlayer2Id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSet" ADD CONSTRAINT "MatchSet_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PTRHistory" ADD CONSTRAINT "PTRHistory_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PTRHistory" ADD CONSTRAINT "PTRHistory_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmericanoEvent" ADD CONSTRAINT "AmericanoEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmericanoMatch" ADD CONSTRAINT "AmericanoMatch_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AmericanoEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundRobinEvent" ADD CONSTRAINT "RoundRobinEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundRobinMatch" ADD CONSTRAINT "RoundRobinMatch_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "RoundRobinEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnePointEvent" ADD CONSTRAINT "OnePointEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnePointMatch" ADD CONSTRAINT "OnePointMatch_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "OnePointEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnakeLaddersEvent" ADD CONSTRAINT "SnakeLaddersEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnakeLaddersMatch" ADD CONSTRAINT "SnakeLaddersMatch_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SnakeLaddersEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

