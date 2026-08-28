-- CreateEnum
CREATE TYPE "Recurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "recurrence" "Recurrence" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "recurrenceEndAt" TIMESTAMP(3),
ADD COLUMN     "lastNotifiedOccurrenceAt" TIMESTAMP(3);
