-- Migration: Add group_metadata table for caching WhatsApp group information
-- This table stores group metadata to improve performance when sending messages to groups

CREATE TABLE IF NOT EXISTS group_metadata (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    jid VARCHAR(255) NOT NULL,
    data LONGTEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_group (session_id, jid),
    INDEX idx_session_id (session_id),
    INDEX idx_jid (jid),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
