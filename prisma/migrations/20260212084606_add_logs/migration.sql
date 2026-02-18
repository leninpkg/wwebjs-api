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
