-- Schema para a tabela messages
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- Schema para a tabela processing_logs
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- Schema para a tabela logs_entries
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- Schema para a tabela session_sync
CREATE TABLE IF NOT EXISTS session_sync (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    last_sync_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NULL,
    INDEX idx_session_id (session_id),
    INDEX idx_last_sync_at (last_sync_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
