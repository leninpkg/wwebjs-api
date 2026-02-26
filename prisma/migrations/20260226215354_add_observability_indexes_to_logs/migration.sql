-- CreateIndex
CREATE INDEX `idx_logs_correlation_id` ON `logs`(`correlation_id`);

-- CreateIndex
CREATE INDEX `idx_logs_operation_name` ON `logs`(`operation_name`);
