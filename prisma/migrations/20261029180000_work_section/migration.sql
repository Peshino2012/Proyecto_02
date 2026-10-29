-- CreateEnum
CREATE TYPE "WorkItemKind" AS ENUM ('TASK', 'EVENT', 'DEADLINE');

-- CreateEnum
CREATE TYPE "WorkAuthor" AS ENUM ('USER', 'CLAUDE');

-- CreateEnum
CREATE TYPE "WorkProposalStatus" AS ENUM ('PENDING', 'APPLIED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "workDigestSentDate" TEXT;

-- CreateTable
CREATE TABLE "WorkModule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL DEFAULT '💼',
    "color" TEXT NOT NULL DEFAULT '#eab308',
    "order" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "kind" "WorkItemKind" NOT NULL DEFAULT 'TASK',
    "startAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "reminderMinutesBefore" INTEGER,
    "notifiedAt" TIMESTAMP(3),
    "createdBy" "WorkAuthor" NOT NULL DEFAULT 'USER',
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT,
    "author" "WorkAuthor" NOT NULL,
    "text" TEXT NOT NULL,
    "proposal" JSONB,
    "proposalStatus" "WorkProposalStatus",
    "readAt" TIMESTAMP(3),
    "pushedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkModule_userId_idx" ON "WorkModule"("userId");

-- CreateIndex
CREATE INDEX "WorkItem_userId_startAt_idx" ON "WorkItem"("userId", "startAt");

-- CreateIndex
CREATE INDEX "WorkItem_moduleId_idx" ON "WorkItem"("moduleId");

-- CreateIndex
CREATE INDEX "WorkMessage_userId_createdAt_idx" ON "WorkMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkMessage_moduleId_idx" ON "WorkMessage"("moduleId");

-- AddForeignKey
ALTER TABLE "WorkModule" ADD CONSTRAINT "WorkModule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "WorkModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkMessage" ADD CONSTRAINT "WorkMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkMessage" ADD CONSTRAINT "WorkMessage_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "WorkModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

