/*
  Warnings:

  - You are about to drop the `message_reactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `messages` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `message_processing_status` DROP FOREIGN KEY `message_processing_status_message_id_fkey`;

-- DropForeignKey
ALTER TABLE `message_reactions` DROP FOREIGN KEY `message_reactions_message_id_fkey`;

-- DropForeignKey
ALTER TABLE `parsed_messages` DROP FOREIGN KEY `parsed_messages_message_id_fkey`;

-- AlterTable
ALTER TABLE `baileys_auth` MODIFY `value` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `message_reactions`;

-- DropTable
DROP TABLE `messages`;

-- CreateTable
CREATE TABLE `group_metadata` (
    `id` VARCHAR(191) NOT NULL,
    `remote_jid` VARCHAR(191) NOT NULL,
    `instance` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `metadata` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `raw_messages` (
    `id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `remote_jid` VARCHAR(191) NOT NULL,
    `instance` VARCHAR(191) NOT NULL,
    `timestamp` VARCHAR(20) NOT NULL,
    `key_data` JSON NOT NULL,
    `message_data` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `parsed_messages` ADD CONSTRAINT `parsed_messages_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `raw_messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_processing_status` ADD CONSTRAINT `message_processing_status_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `raw_messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
