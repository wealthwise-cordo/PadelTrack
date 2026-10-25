-- CreateTable
CREATE TABLE "AdminMatchAction" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "byId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminMatchAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminMatchAction_createdAt_idx" ON "AdminMatchAction"("createdAt");

-- AddForeignKey
ALTER TABLE "AdminMatchAction" ADD CONSTRAINT "AdminMatchAction_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

