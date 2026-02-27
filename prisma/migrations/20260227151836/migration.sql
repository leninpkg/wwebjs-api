/*
  Warnings:

  - You are about to drop the column `file_path` on the `raw_message_files` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `raw_message_files` DROP COLUMN `file_path`;
