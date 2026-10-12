-- AlterTable
ALTER TABLE "RoundRobinEvent" ADD COLUMN     "scoring" TEXT NOT NULL DEFAULT 'games';

-- AlterTable
ALTER TABLE "RoundRobinMatch" ADD COLUMN     "autoConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "sets" JSONB,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "submittedById" TEXT;
