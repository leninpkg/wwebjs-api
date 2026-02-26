/*
  Warnings:

  - You are about to drop the `parsed_messages` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `parsed_messages` DROP FOREIGN KEY `parsed_messages_message_id_fkey`;

-- DropTable
DROP TABLE `parsed_messages`;

-- CreateTable
CREATE TABLE `inpulse_messages` (
    `message_id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `instance` VARCHAR(191) NOT NULL,
    `from` VARCHAR(191) NOT NULL,
    `to` VARCHAR(191) NOT NULL,
    `type` ENUM('text', 'ptt', 'image', 'video', 'audio', 'document', 'sticker', 'list', 'location', 'contact', 'multi_contact', 'unsupported') NOT NULL,
    `quoted_id` VARCHAR(191) NULL,
    `body` TEXT NULL,
    `timestamp` VARCHAR(20) NOT NULL,
    `sent_at` DATETIME(3) NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'RECEIVED', 'READ', 'DOWNLOADED', 'ERROR', 'REVOKED') NOT NULL,
    `file_id` VARCHAR(191) NULL,
    `file_name` TEXT NULL,
    `file_type` VARCHAR(191) NULL,
    `file_size` INTEGER NULL,
    `is_forwarded` BOOLEAN NOT NULL,
    `is_edited` BOOLEAN NOT NULL,

    INDEX `idx_inpulse_messages_session_id`(`session_id`),
    INDEX `idx_inpulse_messages_from`(`from`),
    UNIQUE INDEX `inpulse_messages_message_id_key`(`message_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inpulse_messages` ADD CONSTRAINT `inpulse_messages_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `raw_messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
