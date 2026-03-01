-- AlterTable
ALTER TABLE `baileys_auth` MODIFY `value` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `logs` MODIFY `metadata` TEXT NULL;

-- AlterTable
ALTER TABLE `raw_groups` MODIFY `group_data` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `raw_messages` MODIFY `key_data` TEXT NOT NULL,
    MODIFY `message_data` TEXT NOT NULL;
