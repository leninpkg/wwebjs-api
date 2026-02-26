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
CREATE TABLE `group_metadata` (
    `id` VARCHAR(191) NOT NULL,
    `remote_jid` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `instance` VARCHAR(191) NOT NULL,
    `metadata` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_group_metadata_remote_jid`(`remote_jid`),
    INDEX `idx_group_metadata_session_id`(`session_id`),
    INDEX `idx_group_metadata_instance`(`instance`),
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

-- CreateTable
CREATE TABLE `raw_message_files` (
    `id` VARCHAR(191) NOT NULL,
    `message_id` VARCHAR(191) NOT NULL,
    `inpulse_id` INTEGER NULL,
    `file_name` TEXT NOT NULL,
    `file_type` VARCHAR(191) NOT NULL,
    `file_size` INTEGER NULL,
    `file_path` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `raw_message_files_message_id_key`(`message_id`),
    UNIQUE INDEX `raw_message_files_inpulse_id_key`(`inpulse_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `raw_contacts` (
    `id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `instance` VARCHAR(191) NOT NULL,
    `phone_number` VARCHAR(50) NULL,
    `name` VARCHAR(255) NULL,
    `notify` VARCHAR(255) NULL,
    `verifiedName` VARCHAR(255) NULL,
    `img_url` TEXT NULL,
    `status` TEXT NULL,
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
CREATE TABLE `logs` (
    `id` VARCHAR(191) NOT NULL,
    `level` ENUM('trace', 'debug', 'info', 'warn', 'error', 'fatal') NOT NULL,
    `message` TEXT NOT NULL,
    `metadata` JSON NULL,
    `session_id` VARCHAR(191) NULL,
    `instance` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_logs_level`(`level`),
    INDEX `idx_logs_session_id`(`session_id`),
    INDEX `idx_logs_created_at`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `raw_message_files` ADD CONSTRAINT `raw_message_files_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `raw_messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parsed_messages` ADD CONSTRAINT `parsed_messages_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `raw_messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_processing_status` ADD CONSTRAINT `message_processing_status_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `raw_messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
