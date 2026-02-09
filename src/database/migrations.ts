import type { Migration } from "./migrator";

/**
 * Lista de todas as migrations da aplicação.
 *
 * REGRAS:
 * - Cada migration tem um `check` SQL que verifica se já foi aplicada (retorna linhas = já aplicada)
 * - Cada migration tem um `up` SQL (ou array de SQLs) para aplicar
 * - Migrations são executadas em ordem alfabética pelo `name`
 * - Para adicionar uma nova migration, basta adicionar um item ao array
 */
const migrations: Migration[] = [
  // ============================================================
  // 000 - Tabelas base (messages, logs, logs_entries)
  // ============================================================
  {
    name: "000_create_messages_table",
    description: "Create messages table for storing WhatsApp messages",
    check: `
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'messages'
      LIMIT 1
    `,
    up: `
      CREATE TABLE IF NOT EXISTS messages (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        remote_jid VARCHAR(255),
        message_id VARCHAR(255),
        from_me TINYINT(1) DEFAULT 0,
        key_data LONGTEXT NOT NULL,
        message_data LONGTEXT NOT NULL,
        processing_status ENUM('processing', 'success', 'failed') NOT NULL DEFAULT 'processing',
        parsed_message LONGTEXT NULL,
        is_parsed TINYINT(1) NOT NULL DEFAULT 0,
        is_emitted TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL,
        UNIQUE KEY unique_message (session_id, remote_jid, message_id, from_me),
        INDEX idx_session_id (session_id),
        INDEX idx_remote_jid (remote_jid),
        INDEX idx_created_at (created_at),
        INDEX idx_processing_status (processing_status),
        INDEX idx_is_parsed (is_parsed),
        INDEX idx_is_emitted (is_emitted)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci
    `,
  },
  {
    name: "000_create_logs_table",
    description: "Create logs table for processing logs",
    check: `
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'logs'
      LIMIT 1
    `,
    up: `
      CREATE TABLE IF NOT EXISTS logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        instance VARCHAR(255) NOT NULL,
        process_name VARCHAR(255) NOT NULL,
        process_id VARCHAR(255) NOT NULL UNIQUE,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        duration_ms BIGINT NOT NULL,
        logs_entries LONGTEXT NOT NULL,
        input LONGTEXT,
        output LONGTEXT,
        has_error TINYINT(1) DEFAULT 0,
        error LONGTEXT,
        error_message VARCHAR(1024),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL,
        INDEX idx_instance (instance),
        INDEX idx_process_name (process_name),
        INDEX idx_process_id (process_id),
        INDEX idx_start_time (start_time),
        INDEX idx_has_error (has_error),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci
    `,
  },
  {
    name: "000_create_logs_entries_table",
    description: "Create logs_entries table for detailed log entries",
    check: `
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'logs_entries'
      LIMIT 1
    `,
    up: `
      CREATE TABLE IF NOT EXISTS logs_entries (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        log_id BIGINT NOT NULL,
        process_id VARCHAR(255) NOT NULL,
        log_message VARCHAR(1024) NOT NULL,
        log_level ENUM('INFO', 'DEBUG', 'ERROR') NOT NULL,
        log_data LONGTEXT,
        created_at DATETIME NOT NULL,
        INDEX idx_log_id (log_id),
        INDEX idx_process_id (process_id),
        INDEX idx_log_level (log_level),
        INDEX idx_created_at (created_at),
        CONSTRAINT fk_log_id FOREIGN KEY (log_id)
          REFERENCES logs(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci
    `,
  },

  // ============================================================
  // 001 - Rename raw_messages -> messages + add processing columns
  // (para bancos que ainda tinham raw_messages)
  // ============================================================
  {
    name: "001_rename_raw_messages_to_messages",
    description: "Rename raw_messages to messages and add processing columns",
    check: `
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'messages'
      LIMIT 1
    `,
    up: [
      `RENAME TABLE raw_messages TO messages`,
      `ALTER TABLE messages
        ADD COLUMN processing_status ENUM('processing', 'success', 'failed') NOT NULL DEFAULT 'processing' AFTER key_data,
        ADD COLUMN parsed_message LONGTEXT NULL AFTER processing_status,
        ADD COLUMN is_parsed BOOLEAN NOT NULL DEFAULT FALSE AFTER parsed_message,
        ADD COLUMN is_emitted BOOLEAN NOT NULL DEFAULT FALSE AFTER is_parsed`,
      `ALTER TABLE messages
        ADD INDEX idx_processing_status (processing_status),
        ADD INDEX idx_is_parsed (is_parsed),
        ADD INDEX idx_is_emitted (is_emitted)`,
    ],
  },

  // ============================================================
  // 002 - Session sync table
  // ============================================================
  {
    name: "002_add_session_sync_table",
    description: "Create session_sync table for tracking last sync date",
    check: `
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'session_sync'
      LIMIT 1
    `,
    up: `
      CREATE TABLE IF NOT EXISTS session_sync (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL UNIQUE,
        last_sync_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_session_id (session_id),
        INDEX idx_last_sync_at (last_sync_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },

  // ============================================================
  // 003 - Group metadata table
  // ============================================================
  {
    name: "003_add_group_metadata_table",
    description: "Create group_metadata table for caching WhatsApp group information",
    check: `
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'group_metadata'
      LIMIT 1
    `,
    up: `
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci
    `,
  },

  // ============================================================
  // 004 - LID mapping table
  // ============================================================
  {
    name: "004_add_lid_mapping_table",
    description: "Create lid_mapping table for LID to phone number resolution",
    check: `
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'lid_mapping'
      LIMIT 1
    `,
    up: `
      CREATE TABLE IF NOT EXISTS lid_mapping (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL,
        lid VARCHAR(255) NOT NULL COMMENT 'Linked Device ID (e.g., 148309633146897)',
        phone_number VARCHAR(255) NOT NULL COMMENT 'Phone number (e.g., 5511999999999)',
        contact_name VARCHAR(255) NULL COMMENT 'Contact name if available',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_lid_mapping (session_id, lid),
        INDEX idx_session_id (session_id),
        INDEX idx_lid (lid),
        INDEX idx_phone_number (phone_number),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci
    `,
  },
];

export default migrations;
