-- AlterTable
ALTER TABLE "QuickTask" ADD COLUMN     "lastReminderSentDate" TEXT,
ADD COLUMN     "reminderHour" INTEGER,
ADD COLUMN     "reminderMinute" INTEGER;
