-- AlterTable
ALTER TABLE "Event" DROP COLUMN "countdownDays",
ADD COLUMN     "countdownFrom" TEXT,
ADD COLUMN     "countdownTo" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "target" INTEGER,
ADD COLUMN     "targetUnit" TEXT;

-- AlterTable
ALTER TABLE "UserProgress" ADD COLUMN     "cleanStreak" INTEGER NOT NULL DEFAULT 0;

