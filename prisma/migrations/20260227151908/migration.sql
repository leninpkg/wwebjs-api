/*
  Warnings:

  - You are about to drop the column `file_name` on the `raw_message_files` table. All the data in the column will be lost.
  - You are about to drop the column `file_size` on the `raw_message_files` table. All the data in the column will be lost.
  - You are about to drop the column `file_type` on the `raw_message_files` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `raw_message_files` DROP COLUMN `file_name`,
    DROP COLUMN `file_size`,
    DROP COLUMN `file_type`;
