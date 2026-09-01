-- DropForeignKey
ALTER TABLE "WebAuthnCredential" DROP CONSTRAINT "WebAuthnCredential_userId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "requireBiometricAppLock";

-- DropTable
DROP TABLE "WebAuthnCredential";
