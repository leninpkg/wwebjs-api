-- Migration: Add lid_mapping table for LID (Linked Device ID) to phone number mapping
-- The WhatsApp protocol now uses LIDs instead of phone numbers in some cases.
-- This table stores the mapping between LIDs and real phone numbers (PNs).

CREATE TABLE IF NOT EXISTS lid_mapping (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    lid VARCHAR(255) NOT NULL COMMENT 'Linked Device ID (e.g., 148309633146897@lid)',
    phone_number VARCHAR(255) NOT NULL COMMENT 'Phone number JID (e.g., 5511999999999@s.whatsapp.net)',
    contact_name VARCHAR(255) NULL COMMENT 'Contact name if available',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_lid_mapping (session_id, lid),
    INDEX idx_session_id (session_id),
    INDEX idx_lid (lid),
    INDEX idx_phone_number (phone_number),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
