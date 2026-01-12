-- Migration: Rename raw_messages to messages and add processing columns
-- Date: 2026-01-12
-- Description: 
--   - Rename table raw_messages to messages
--   - Add processing_status column (ENUM: processing, success, failed)
--   - Add parsed_message column (JSON of parsed message)
--   - Add is_parsed column (boolean)
--   - Add is_emitted column (boolean)

-- Rename the table
RENAME TABLE raw_messages TO messages;

-- Add new columns
ALTER TABLE messages
    ADD COLUMN processing_status ENUM('processing', 'success', 'failed') NOT NULL DEFAULT 'processing' AFTER key_data,
    ADD COLUMN parsed_message LONGTEXT NULL AFTER processing_status,
    ADD COLUMN is_parsed BOOLEAN NOT NULL DEFAULT FALSE AFTER parsed_message,
    ADD COLUMN is_emitted BOOLEAN NOT NULL DEFAULT FALSE AFTER is_parsed;

-- Add indexes for the new columns
ALTER TABLE messages
    ADD INDEX idx_processing_status (processing_status),
    ADD INDEX idx_is_parsed (is_parsed),
    ADD INDEX idx_is_emitted (is_emitted);
