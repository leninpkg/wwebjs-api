-- AlterTable
ALTER TABLE `baileys_auth` MODIFY `value` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `logs` MODIFY `metadata` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `raw_groups` MODIFY `group_data` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `raw_messages` MODIFY `key_data` VARCHAR(191) NOT NULL,
    MODIFY `message_data` VARCHAR(191) NOT NULL;
