-- CreateTable
CREATE TABLE `raw_contacts` (
    `id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NOT NULL,
    `instance` VARCHAR(191) NOT NULL,
    `phone_number` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NULL,
    `notify` VARCHAR(255) NULL,
    `verifiedName` VARCHAR(255) NULL,
    `img_url` TEXT NULL,
    `status` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
