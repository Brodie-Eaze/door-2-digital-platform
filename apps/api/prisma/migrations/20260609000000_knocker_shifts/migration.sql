-- CreateEnum
CREATE TYPE "KnockerShiftStatus" AS ENUM ('scheduled', 'active', 'lunch', 'missed', 'completed');

-- CreateTable
CREATE TABLE "KnockerShift" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "repInitials" TEXT NOT NULL,
    "repName" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "territory" TEXT NOT NULL,
    "lunch" TEXT,
    "status" "KnockerShiftStatus" NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnockerShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnockerShift_orgId_weekStart_idx" ON "KnockerShift"("orgId", "weekStart");

-- AddForeignKey
ALTER TABLE "KnockerShift" ADD CONSTRAINT "KnockerShift_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
