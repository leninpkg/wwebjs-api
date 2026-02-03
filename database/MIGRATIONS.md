# Database Migrations

## How to Apply Migrations

Connect to your MySQL database and run the migration files in order:

```bash
mysql -u your_user -p wwebjs-nunes < database/migrations/003_add_group_metadata_table.sql
```

Or connect to MySQL and run:

```sql
USE wwebjs-nunes;
SOURCE database/migrations/003_add_group_metadata_table.sql;
```

## Migration 003: Add group_metadata Table

This migration adds support for caching WhatsApp group metadata, which improves performance when sending messages to groups.

**What it does:**
- Creates the `group_metadata` table
- Stores group information (subject, participants, etc.) to avoid repeated API calls
- Includes indexes for efficient querying

**Impact:**
- Fixes the error: "Table 'wwebjs-nunes.group_metadata' doesn't exist"
- Enables proper group message functionality
- Improves performance for group operations

**Required for:**
- Sending messages to WhatsApp groups via Internal Chats
- Group metadata caching

## Verification

After running the migration, verify it was successful:

```sql
SHOW TABLES LIKE 'group_metadata';
DESCRIBE group_metadata;
```

Expected output should show the table structure with columns:
- id
- session_id
- jid
- data
- created_at
- updated_at
