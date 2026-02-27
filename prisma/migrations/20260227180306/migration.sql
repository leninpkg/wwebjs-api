/*
  Warnings:

  - You are about to drop the `group_metadata` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX `idx_inpulse_messages_session_id` ON `inpulse_messages`;

-- DropTable
DROP TABLE `group_metadata`;

-- CreateTable
CREATE TABLE `raw_groups` (
    `session_id` VARCHAR(191) NOT NULL,
    `instance` VARCHAR(191) NOT NULL,
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NULL,
    `group_data` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_raw_groups_instance`(`instance`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_inpulse_messages_instance` ON `inpulse_messages`(`instance`);

-- CreateIndex
CREATE INDEX `idx_inpulse_messages_to` ON `inpulse_messages`(`to`);

-- CreateIndex
CREATE INDEX `idx_raw_contacts_instance` ON `raw_contacts`(`instance`);

-- CreateIndex
CREATE INDEX `idx_raw_contacts_phone_number` ON `raw_contacts`(`phone_number`);

-- CreateIndex
CREATE INDEX `idx_raw_contacts_lid` ON `raw_contacts`(`lid`);

-- CreateIndex
CREATE INDEX `idx_raw_message_files_message_id` ON `raw_message_files`(`message_id`);

-- CreateIndex
CREATE INDEX `idx_raw_messages_instance` ON `raw_messages`(`instance`);

-- CreateIndex
CREATE INDEX `idx_raw_messages_remote_jid` ON `raw_messages`(`remote_jid`);
