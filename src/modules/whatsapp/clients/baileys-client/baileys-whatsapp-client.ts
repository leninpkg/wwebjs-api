import makeWASocket, { MessageUpsertType, WAMessage, WAMessageUpdate, type ConnectionState } from "baileys";
import "dotenv/config";
import ProcessingLogger from "../../../../utils/processing-logger";
import type DataClient from "../../../data/data-client";
import WppEventEmitter from "../../../events/emitter/emitter";
import type MessageDto from "../../types";
import type { EditMessageOptions, FetchMessageHistoryOptions, FetchMessageHistoryResult, SendMessageOptions } from "../../types";
import WhatsappClient from "../whatsapp-client";
import handleConnectionUpdate from "./handle-connection-update";
import handleEditMessage from "./handle-edit-message";
import handleFetchMessageHistory, { reprocessHistoryMessages } from "./handle-fetch-message-history";
import handleMessageUpdate from "./handle-message-update";
import handleMessageUpsert from "./handle-message-upsert";
import handleSendMessage from "./handle-send-message";
import makeNewSocket from "./make-new-socket";

// Data mínima para sincronização de histórico (formato: YYYY-MM-DD ou timestamp em segundos)
// Mensagens anteriores a esta data serão ignoradas
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
const HISTORY_MIN_DATE = process.env["HISTORY_MIN_DATE"]
  ? new Date(process.env["HISTORY_MIN_DATE"]).getTime() / 1000
  : sevenDaysAgo.getTime() / 1000;

class BaileysWhatsappClient implements WhatsappClient {
  public _phone: string = "";

  constructor(
    public sessionId: string,
    public clientId: number,
    public instance: string,
    public _storage: DataClient,
    public _sock: ReturnType<typeof makeWASocket>,
    public _ev: WppEventEmitter,
  ) { }

  public static async build(
    sessionId: string,
    clientId: number,
    instance: string,
    storage: DataClient,
    eventEmitter: WppEventEmitter,
  ): Promise<BaileysWhatsappClient> {
    const socket = await makeNewSocket(sessionId, storage);
    const client = new BaileysWhatsappClient(sessionId, clientId, instance, storage, socket, eventEmitter);
    client.bindEvents();
    return client;
  }

  public bindEvents() {
    this._sock.ev.on("connection.update", this.onConnectionUpdate.bind(this));
    this._sock.ev.on("creds.update", this._storage.saveAuthState.bind(this._storage, this.sessionId));
    this._sock.ev.on("messages.upsert", this.onMessagesUpsert.bind(this));
    this._sock.ev.on("messages.update", this.onMessagesUpdate.bind(this));
    this._sock.ev.on("messaging-history.set", this.onHistorySet.bind(this));
  }

  private getLogger(processName: string, processId: string, input: unknown, debug: boolean = false): ProcessingLogger {
    return new ProcessingLogger(this._storage, this.instance, processName, processId, input, debug);
  }

  private async onConnectionUpdate(update: Partial<ConnectionState>) {
    const processId = `conn-update-${Date.now()}`;
    const logger = this.getLogger("Connection Update", processId, update);
    try {
      await handleConnectionUpdate({ update, client: this, logger });
    } catch (error) {
      logger.failed(error);
    }
  }

  private async onMessagesUpsert({ messages, type }: { messages: WAMessage[]; type: MessageUpsertType }) {
    const processId = `messages-upsert-${Date.now()}`;
    const logger = this.getLogger("Messages Upsert", processId, { type, messageCount: messages.length });
    try {
      await handleMessageUpsert({ messages, type, client: this, logger });
    } catch (error) {
      logger.failed(error);
    }
  }

  private async onMessagesUpdate(updates: WAMessageUpdate[]) {
    const processId = `messages-update-${Date.now()}`;
    const logger = this.getLogger("Messages Update", processId, { updateCount: updates.length });
    try {
      await handleMessageUpdate({ updates, client: this, logger });
    } catch (error) {
      logger.failed(error);
    }
  }

  private async onHistorySet({ messages, isLatest }: { messages: WAMessage[]; isLatest?: boolean }) {
    const processId = `history-set-${Date.now()}`;
    const logger = this.getLogger("History Set", processId, { messageCount: messages.length, isLatest }, true);
    try {
      logger.log(`Received messaging history set`, { messageCount: messages.length, isLatest });

      // Get last sync date to avoid reprocessing
      const lastSyncAt = await this._storage.getLastSyncAt(this.sessionId);
      logger.log("Last sync date retrieved", { lastSyncAt });

      let savedCount = 0;
      let skippedCount = 0;
      let skippedByDateCount = 0;

      // Calcular a data mínima para filtrar mensagens
      // Usar a mais recente entre HISTORY_MIN_DATE e lastSyncAt
      const lastSyncAtTimestamp = lastSyncAt ? lastSyncAt.getTime() / 1000 : null;
      const minTimestamp = Math.max(HISTORY_MIN_DATE || 0, lastSyncAtTimestamp || 0) || null;

      logger.log("Filtering messages", { minTimestamp, HISTORY_MIN_DATE, lastSyncAtTimestamp });

      // Salvar mensagens no storage (apenas novas)
      for (const message of messages) {
        if (message.message && message.key.id) {
          // Filtrar mensagens anteriores à data mínima (HISTORY_MIN_DATE ou lastSyncAt)
          if (minTimestamp && message.messageTimestamp) {
            const messageTimestamp = typeof message.messageTimestamp === "number"
              ? message.messageTimestamp
              : Number(message.messageTimestamp);
            if (messageTimestamp < minTimestamp) {
              skippedByDateCount++;
              continue;
            }
          }

          // Check if message already exists in database
          const exists = await this._storage.messageExists(this.sessionId, message.key.id);
          if (exists) {
            skippedCount++;
            continue;
          }

          logger?.log("Saving message from history", { messageId: message.key?.id });
          await this._storage.saveMessage({
            sessionId: this.sessionId,
            message: message.message,
            key: message.key,
          });
          savedCount++;
        }
      }

      logger.log("Messages saved", { savedCount, skippedCount });

      // Reprocessar mensagens (emitir eventos)
      const processedMessages = await reprocessHistoryMessages(this, messages, logger);

      // Update last sync date
      await this._storage.updateLastSyncAt(this.sessionId);
      logger.log("Last sync date updated");

      logger.success({ savedMessages: savedCount, skippedMessages: skippedCount, skippedByDate: skippedByDateCount, processedMessages: processedMessages.length });
    } catch (error) {
      logger.failed(error);
    }
  }

  public isValidWhatsapp(phone: string): Promise<boolean> {
    const processId = `validate-whatsapp-${Date.now()}`;
    const logger = this.getLogger("Validate WhatsApp", processId, { phone });

    logger.log(`Checking if phone number is valid WhatsApp: ${phone}`);
    throw new Error("Method not implemented.");
  }

  public async sendMessage(props: SendMessageOptions, isGroup: boolean = false): Promise<MessageDto> {
    const processId = `send-message-${Date.now()}`;
    const logger = this.getLogger("Send Message", processId, { props, isGroup });
    try {
      return await handleSendMessage({ client: this, options: props, isGroup, logger });
    } catch (error) {
      logger.failed(error);
      throw error;
    }
  }

  public async editMessage(props: EditMessageOptions): Promise<MessageDto> {
    const processId = `edit-message-${Date.now()}`;
    const logger = this.getLogger("Edit Message", processId, { props });
    try {
      return await handleEditMessage({ client: this, options: props, logger });
    } catch (error) {
      logger.failed(error);
      throw error;
    }
  }

  public async fetchMessageHistory(options: FetchMessageHistoryOptions): Promise<FetchMessageHistoryResult> {
    const processId = `fetch-history-${Date.now()}`;
    const logger = this.getLogger("Fetch Message History", processId, { options });
    try {
      return await handleFetchMessageHistory({ client: this, options, logger });
    } catch (error) {
      logger.failed(error);
      throw error;
    }
  }

  public async getAvatarUrl(phone: string): Promise<string | null> {
    const processId = `get-avatar-${Date.now()}`;
    const logger = this.getLogger("Get Avatar URL", processId, { phone });

    try {
      logger.log(`Getting avatar URL for phone number: ${phone}`);

      // Normalize phone to JID format
      const cleanPhone = phone.replace("@s.whatsapp.net", "").trim();
      if (!cleanPhone || !/^\d+$/.test(cleanPhone)) {
        throw new Error(`Invalid phone number format: ${phone}`);
      }

      const jid = `${cleanPhone}@s.whatsapp.net`;

      // Get avatar URL from socket
      const avatarUrl = await this._sock.profilePictureUrl(jid, "image");

      logger.success(`Avatar URL retrieved: ${avatarUrl}`);
      return avatarUrl || null;
    } catch (error) {
      logger.failed(`Failed to get avatar URL: ${error}`);
      return null;
    }
  }

  get phone(): string {
    return this._phone;
  }
}

export default BaileysWhatsappClient;
