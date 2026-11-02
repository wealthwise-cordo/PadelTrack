-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminPasswordHash" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3);
