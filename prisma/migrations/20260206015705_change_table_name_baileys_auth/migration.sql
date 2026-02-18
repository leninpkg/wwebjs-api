/*
  Warnings:

  - You are about to drop the `rawmessages` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE `rawmessages`;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(191) NOT NULL,
    `instance` VARCHAR(191) NOT NULL,
    `api_type` ENUM('baileys', 'wwebjs', 'gupshup', 'waba') NOT NULL,
    `description` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `baileys_auth` (
    `session_id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(255) NOT NULL,
    `value` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_baileys_data_session_id`(`session_id`),
    INDEX `idx_baileys_data_key`(`key`),
    UNIQUE INDEX `baileys_auth_session_id_key_key`(`session_id`, `key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` VARCHAR(191) NOT NULL,
    `instance` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `message_data` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parsed_messages` (
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

    INDEX `idx_parsed_messages_session_id`(`session_id`),
    INDEX `idx_parsed_messages_from`(`from`),
    UNIQUE INDEX `parsed_messages_message_id_key`(`message_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_processing_status` (
    `message_id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `is_parsed` BOOLEAN NOT NULL,
    `is_saved` BOOLEAN NOT NULL,
    `is_updated` BOOLEAN NOT NULL,

    UNIQUE INDEX `message_processing_status_message_id_key`(`message_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_reactions` (
    `id` VARCHAR(191) NOT NULL,
    `message_id` VARCHAR(191) NOT NULL,
    `reaction` VARCHAR(191) NOT NULL,
    `reacted_by` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_message_reactions_message_id`(`message_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `parsed_messages` ADD CONSTRAINT `parsed_messages_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_processing_status` ADD CONSTRAINT `message_processing_status_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_reactions` ADD CONSTRAINT `message_reactions_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
