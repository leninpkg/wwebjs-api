import { proto, type AuthenticationState, type GroupMetadata, type SignalKeyStore, type WAMessageKey } from "baileys";
import { Message } from "../whatsapp/clients/baileys-client/types";

export interface SaveMessageOptions {
  sessionId: string;
  message: proto.IMessage;
  key: WAMessageKey;
}

export interface UpdateMessageOptions {
  sessionId: string;
  messageId: string;
  parsedMessage?: any;
  isParsed?: boolean;
  isEmitted?: boolean;
  processingStatus?: "processing" | "success" | "failed";
}

abstract class DataClient {
  public abstract getSignalKeyStore(sessionId: string): Promise<SignalKeyStore>;
  public abstract getGroupMetadata(sessionId: string, jid: string): Promise<GroupMetadata | undefined>;
  public abstract saveGroupMetadata(sessionId: string, jid: string, metadata: GroupMetadata): Promise<void>;
  public abstract getRawMessage(sessionId: string, key: WAMessageKey): Promise<proto.IMessage | undefined>;
  public abstract getMessage(sessionId: string, messageId: string): Promise<Message | null>;
  public abstract messageExists(sessionId: string, messageId: string): Promise<boolean>;
  public abstract saveMessage(options: SaveMessageOptions): Promise<number | null>;
  public abstract updateMessage(options: UpdateMessageOptions): Promise<void>;
  public abstract getLastSyncAt(sessionId: string): Promise<Date | null>;
  public abstract updateLastSyncAt(sessionId: string): Promise<void>;
  public abstract getAuthState(sessionId: string): Promise<AuthenticationState>;
  public abstract saveAuthState(sessionId: string): Promise<void>;
  public abstract clearAuthState(sessionId: string): Promise<void>;
  public abstract unsafeQuery<T>(query: string, params?: any[]): Promise<T[]>;

  // LID (Linked Device ID) to Phone Number mapping
  public abstract saveLidMapping(sessionId: string, lid: string, phoneNumber: string, contactName?: string): Promise<void>;
  public abstract getPhoneByLid(sessionId: string, lid: string): Promise<string | null>;
  public abstract saveLidMappings(sessionId: string, mappings: Array<{ lid: string; phoneNumber: string; contactName?: string }>): Promise<void>;

  // Backwards compatibility aliases
  /** @deprecated Use saveMessage instead */
  public async saveRawMessage(sessionId: string, message: proto.IMessage, key: WAMessageKey): Promise<void> {
    await this.saveMessage({ sessionId, message, key });
  }

  /** @deprecated Use getFullMessage instead */
  public async getFullRawMessage(sessionId: string, messageId: string): Promise<Message | null> {
    return this.getMessage(sessionId, messageId);
  }
}

export default DataClient;
