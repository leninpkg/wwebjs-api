/*
  Warnings:

  - Made the column `file_name` on table `raw_message_files` required. This step will fail if there are existing NULL values in that column.
  - Made the column `file_type` on table `raw_message_files` required. This step will fail if there are existing NULL values in that column.
  - Made the column `file_path` on table `raw_message_files` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `raw_message_files` MODIFY `file_name` TEXT NOT NULL,
    MODIFY `file_type` VARCHAR(191) NOT NULL,
    MODIFY `file_path` TEXT NOT NULL;
