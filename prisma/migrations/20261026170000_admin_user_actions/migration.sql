-- CreateTable
CREATE TABLE "AdminUserAction" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" JSONB,
    "byId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUserAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminUserAction_createdAt_idx" ON "AdminUserAction"("createdAt");

-- AddForeignKey
ALTER TABLE "AdminUserAction" ADD CONSTRAINT "AdminUserAction_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
