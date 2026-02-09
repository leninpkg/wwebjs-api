import {
  makeCacheableSignalKeyStore,
  type AuthenticationState,
  type GroupMetadata,
  type proto,
  type SignalKeyStore,
  type WAMessageKey,
} from "baileys";
import type { ILogger } from "baileys/lib/Utils/logger";
import { useMySQLAuthState } from "mysql-baileys";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { createPool } from "mysql2/promise";
import DataClient from "./data-client";
import type { SaveMessageOptions, UpdateMessageOptions } from "./data-client";
import { Logger } from "@in.pulse-crm/utils";
import { Message, MessageJson } from "../whatsapp/clients/baileys-client/types";

type MySQLAuthState = Awaited<ReturnType<typeof useMySQLAuthState>>;

class MySQLDataClient extends DataClient {
  private pool: Pool;
  private mysqlAuthStateMap: Map<string, MySQLAuthState> = new Map();

  constructor(
    private host: string,
    private port: number,
    private user: string,
    private password: string,
    private database: string,
  ) {
    super();
    this.pool = createPool({
      host: this.host,
      port: this.port,
      user: this.user,
      password: this.password,
      database: this.database,
    });
  }

  private async getMysqlAuthState(sessionId: string) {
    if (!this.mysqlAuthStateMap.has(sessionId)) {
      const mysqlAuthState = await useMySQLAuthState({
        session: sessionId,
        database: this.database,
        host: this.host,
        port: this.port,
        user: this.user,
        password: this.password,
      });
      this.mysqlAuthStateMap.set(sessionId, mysqlAuthState);
    }
    return this.mysqlAuthStateMap.get(sessionId)!;
  }

  public async getSignalKeyStore(sessionId: string, logger?: ILogger) {
    const { state } = await this.getMysqlAuthState(sessionId);
    return makeCacheableSignalKeyStore(state.keys as SignalKeyStore, logger);
  }

  public async getGroupMetadata(sessionId: string, jid: string): Promise<GroupMetadata | undefined> {
    try {
      const query = "SELECT data FROM group_metadata WHERE jid = ? AND session_id = ?";
      const [rows] = await this.pool.query<RowDataPacket[]>(query, [jid, sessionId]);

      if (rows[0]) {
        return JSON.parse(rows[0]["data"]) as GroupMetadata;
      }

      return undefined;
    } catch (error: any) {
      // Se a tabela não existe, retorna undefined (o Baileys vai buscar os dados do WhatsApp)
      if (error.code === 'ER_NO_SUCH_TABLE') {
        Logger.info(`Table 'group_metadata' does not exist. Consider running migration 003_add_group_metadata_table.sql`);
        return undefined;
      }
      Logger.error("Error fetching group metadata from MySQL", error);
      return undefined;
    }
  }

  public async saveGroupMetadata(sessionId: string, jid: string, metadata: GroupMetadata): Promise<void> {
    try {
      const query = `
        INSERT INTO group_metadata (session_id, jid, data, created_at)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          data = VALUES(data),
          updated_at = NOW()
      `;
      await this.pool.query(query, [sessionId, jid, JSON.stringify(metadata)]);
    } catch (error: any) {
      // Se a tabela não existe, ignora silenciosamente
      if (error.code !== 'ER_NO_SUCH_TABLE') {
        Logger.error("Error saving group metadata to MySQL", error);
      }
    }
  }

  public async getMessage(sessionId: string, messageId: string): Promise<Message | null> {
    try {
      const query = "SELECT * FROM messages WHERE id = ? AND session_id = ?";
      const [rows] = await this.pool.query<RowDataPacket[]>(query, [messageId, sessionId]);

      if (rows[0]) {
        const resultJson = rows[0] as MessageJson;
        const resultParsed: Message = {
          ...resultJson,
          message_data: JSON.parse(resultJson.message_data) as proto.IMessage,
          key_data: JSON.parse(resultJson.key_data) as proto.IMessageKey,
          parsed_message: resultJson.parsed_message ? JSON.parse(resultJson.parsed_message) : null,
          created_at: new Date(resultJson.created_at),
          updated_at: new Date(resultJson.updated_at),
        };
        return resultParsed;
      }

      return null;
    } catch (error: any) {
      Logger.error("Error fetching message from MySQL", error);
      return null;
    }
  }

  public async getRawMessage(sessionId: string, key: WAMessageKey): Promise<proto.IMessage | undefined> {
    try {
      if (!key.id) {
        return undefined;
      }
      const findMessage = await this.getMessage(sessionId, key.id!);
      return findMessage?.message_data;
    } catch (error: any) {
      return undefined;
    }
  }

  public async messageExists(sessionId: string, messageId: string): Promise<boolean> {
    try {
      const query = "SELECT 1 FROM messages WHERE message_id = ? AND session_id = ? LIMIT 1";
      const [rows] = await this.pool.query<RowDataPacket[]>(query, [messageId, sessionId]);
      return rows.length > 0;
    } catch (error: any) {
      Logger.error("Error checking if message exists", error);
      return false;
    }
  }

  public async saveMessage({ sessionId, message, key }: SaveMessageOptions): Promise<number | null> {
    try {
      const query = `
        INSERT INTO messages (session_id, remote_jid, message_id, message_data, key_data, processing_status, is_parsed, is_emitted, created_at)
        VALUES (?, ?, ?, ?, ?, 'processing', FALSE, FALSE, NOW())
        ON DUPLICATE KEY UPDATE
          message_data = VALUES(message_data),
          updated_at = NOW()
      `;

      const [result] = await this.pool.query<ResultSetHeader>(query, [
        sessionId,
        key.remoteJid,
        key.id,
        JSON.stringify(message),
        JSON.stringify(key),
      ]);

      return result.insertId || null;
    } catch (error: any) {
      Logger.error("Error saving message", error);
      return null;
    }
  }

  public async updateMessage({ sessionId, messageId, parsedMessage, isParsed, isEmitted, processingStatus }: UpdateMessageOptions): Promise<void> {
    try {
      const updates: string[] = [];
      const params: any[] = [];

      if (parsedMessage !== undefined) {
        updates.push("parsed_message = ?");
        params.push(JSON.stringify(parsedMessage));
      }
      if (isParsed !== undefined) {
        updates.push("is_parsed = ?");
        params.push(isParsed);
      }
      if (isEmitted !== undefined) {
        updates.push("is_emitted = ?");
        params.push(isEmitted);
      }
      if (processingStatus !== undefined) {
        updates.push("processing_status = ?");
        params.push(processingStatus);
      }

      if (updates.length === 0) {
        return;
      }

      updates.push("updated_at = NOW()");
      params.push(messageId, sessionId);

      const query = `UPDATE messages SET ${updates.join(", ")} WHERE message_id = ? AND session_id = ?`;
      await this.pool.query(query, params);
    } catch (error: any) {
      Logger.error("Error updating message", error);
    }
  }

  public async getAuthState(sessionId: string) {
    const { state } = await this.getMysqlAuthState(sessionId);

    return state as AuthenticationState;
  }

  public async saveAuthState(sessionId: string) {
    const { saveCreds } = await this.getMysqlAuthState(sessionId);

    await saveCreds();
  }

  public async clearAuthState(sessionId: string) {
    const { clear, removeCreds } = await this.getMysqlAuthState(sessionId);

    await clear();
    await removeCreds();
  }

  public async getLastSyncAt(sessionId: string): Promise<Date | null> {
    try {
      const query = "SELECT last_sync_at FROM session_sync WHERE session_id = ?";
      const [rows] = await this.pool.query<RowDataPacket[]>(query, [sessionId]);

      if (rows[0]) {
        return new Date(rows[0]["last_sync_at"]);
      }

      return null;
    } catch (error: any) {
      Logger.error("Error getting last sync date", error);
      return null;
    }
  }

  public async updateLastSyncAt(sessionId: string): Promise<void> {
    try {
      const query = `
        INSERT INTO session_sync (session_id, last_sync_at)
        VALUES (?, NOW())
        ON DUPLICATE KEY UPDATE
          last_sync_at = NOW(),
          updated_at = NOW()
      `;
      await this.pool.query(query, [sessionId]);
    } catch (error: any) {
      Logger.error("Error updating last sync date", error);
    }
  }

  public async unsafeQuery<T>(query: string, params?: any[]): Promise<T[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(query, params);
    return rows as T[];
  }

  public async saveLidMapping(sessionId: string, lid: string, phoneNumber: string, contactName?: string): Promise<void> {
    try {
      const query = `
        INSERT INTO lid_mapping (session_id, lid, phone_number, contact_name, created_at)
        VALUES (?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          phone_number = VALUES(phone_number),
          contact_name = COALESCE(VALUES(contact_name), contact_name),
          updated_at = NOW()
      `;
      await this.pool.query(query, [sessionId, lid, phoneNumber, contactName || null]);
    } catch (error: any) {
      if (error.code !== 'ER_NO_SUCH_TABLE') {
        Logger.error("Error saving LID mapping", error);
      }
    }
  }

  public async getPhoneByLid(sessionId: string, lid: string): Promise<string | null> {
    try {
      const query = "SELECT phone_number FROM lid_mapping WHERE lid = ? AND session_id = ? LIMIT 1";
      const [rows] = await this.pool.query<RowDataPacket[]>(query, [lid, sessionId]);

      if (rows[0]) {
        return rows[0]["phone_number"] as string;
      }

      return null;
    } catch (error: any) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        Logger.info("Table 'lid_mapping' does not exist. Consider running migration 004_add_lid_mapping_table.sql");
      } else {
        Logger.error("Error fetching LID mapping", error);
      }
      return null;
    }
  }

  public async saveLidMappings(sessionId: string, mappings: Array<{ lid: string; phoneNumber: string; contactName?: string }>): Promise<void> {
    if (mappings.length === 0) return;

    try {
      const query = `
        INSERT INTO lid_mapping (session_id, lid, phone_number, contact_name, created_at)
        VALUES ?
        ON DUPLICATE KEY UPDATE
          phone_number = VALUES(phone_number),
          contact_name = COALESCE(VALUES(contact_name), contact_name),
          updated_at = NOW()
      `;

      const values = mappings.map(m => [sessionId, m.lid, m.phoneNumber, m.contactName || null, new Date()]);
      await this.pool.query(query, [values]);
      Logger.info(`Saved ${mappings.length} LID mappings for session ${sessionId}`);
    } catch (error: any) {
      if (error.code !== 'ER_NO_SUCH_TABLE') {
        Logger.error("Error saving LID mappings in batch", error);
      }
    }
  }
}

export default MySQLDataClient;
