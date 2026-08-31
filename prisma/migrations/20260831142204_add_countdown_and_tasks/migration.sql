-- CreateEnum
CREATE TYPE "TaskStat" AS ENUM ('INTELECTO', 'DISCIPLINA', 'ESPIRITU', 'VITALIDAD', 'FUERZA', 'OTRO');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "countdownDays" INTEGER,
ADD COLUMN     "countdownHour" INTEGER,
ADD COLUMN     "countdownLastSentDate" TEXT,
ADD COLUMN     "countdownMinute" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "taskShareEventCategories" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#0ea5e9',
    "stat" "TaskStat" NOT NULL DEFAULT 'OTRO',
    "xpReward" INTEGER NOT NULL DEFAULT 15,
    "repeatDaily" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "xpAwarded" INTEGER NOT NULL,

    CONSTRAINT "TaskLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "intelecto" INTEGER NOT NULL DEFAULT 0,
    "disciplina" INTEGER NOT NULL DEFAULT 0,
    "espiritu" INTEGER NOT NULL DEFAULT 0,
    "vitalidad" INTEGER NOT NULL DEFAULT 0,
    "fuerza" INTEGER NOT NULL DEFAULT 0,
    "penaltyStrikes" INTEGER NOT NULL DEFAULT 0,
    "inPenaltyZone" BOOLEAN NOT NULL DEFAULT false,
    "lastPenaltyCheckedDate" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");

-- CreateIndex
CREATE INDEX "TaskLog_taskId_idx" ON "TaskLog"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskLog_taskId_date_key" ON "TaskLog"("taskId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_userId_key" ON "UserProgress"("userId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskLog" ADD CONSTRAINT "TaskLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

