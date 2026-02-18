/*
  Warnings:

  - You are about to alter the column `value` on the `baileys_auth` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.

*/
-- AlterTable
ALTER TABLE `baileys_auth` MODIFY `value` JSON NOT NULL;
