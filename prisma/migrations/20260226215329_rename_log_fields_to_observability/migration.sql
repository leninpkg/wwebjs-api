/*
  Warnings:

  - You are about to drop the column `process_id` on the `logs` table. All the data in the column will be lost.
  - You are about to drop the column `process_name` on the `logs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `logs` DROP COLUMN `process_id`,
    DROP COLUMN `process_name`,
    ADD COLUMN `correlation_id` VARCHAR(191) NULL,
    ADD COLUMN `operation_name` VARCHAR(191) NULL;
