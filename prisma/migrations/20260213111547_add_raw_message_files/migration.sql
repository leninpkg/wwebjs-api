-- CreateTable
CREATE TABLE `raw_message_files` (
    `id` VARCHAR(191) NOT NULL,
    `message_id` VARCHAR(191) NOT NULL,
    `inpulse_id` INTEGER NULL,
    `file_name` TEXT NULL,
    `file_type` VARCHAR(191) NULL,
    `file_size` INTEGER NULL,
    `file_path` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `raw_message_files_message_id_key`(`message_id`),
    UNIQUE INDEX `raw_message_files_inpulse_id_key`(`inpulse_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_group_metadata_remote_jid` ON `group_metadata`(`remote_jid`);

-- CreateIndex
CREATE INDEX `idx_group_metadata_session_id` ON `group_metadata`(`session_id`);

-- CreateIndex
CREATE INDEX `idx_group_metadata_instance` ON `group_metadata`(`instance`);

-- AddForeignKey
ALTER TABLE `raw_message_files` ADD CONSTRAINT `raw_message_files_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `raw_messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
