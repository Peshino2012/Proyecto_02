-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deviceTopic" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_deviceTopic_key" ON "User"("deviceTopic");

