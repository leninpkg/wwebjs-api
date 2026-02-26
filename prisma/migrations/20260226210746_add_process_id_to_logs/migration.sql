-- AlterTable
ALTER TABLE `logs` ADD COLUMN `emitted_by` VARCHAR(191) NULL,
    ADD COLUMN `process_id` VARCHAR(191) NULL,
    ADD COLUMN `process_name` VARCHAR(191) NULL;
