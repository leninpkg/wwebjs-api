import makeWASocket, { type Contact, MessageUpsertType, WAMessage, WAMessageUpdate, type ConnectionState } from "baileys";
import Bottleneck from "bottleneck";
import "dotenv/config";
import ProcessingLogger from "../../../../utils/processing-logger";
import type DataClient from "../../../data/data-client";
import WppEventEmitter from "../../../events/emitter/emitter";
import type MessageDto from "../../types";
import type { EditMessageOptions, FetchMessageHistoryOptions, FetchMessageHistoryResult, SendMessageOptions } from "../../types";
import WhatsappClient from "../whatsapp-client";
import handleConnectionUpdate from "./handle-connection-update";
import handleEditMessage from "./handle-edit-message";
import handleHistorySet from "./handle-history-set";
import handleMessageUpdate from "./handle-message-update";
import handleMessageUpsert from "./handle-message-upsert";
import handleSendMessage from "./handle-send-message";
import makeNewSocket from "./make-new-socket";
import handleContactsUpsert from "./handle-contacts-upsert";

class BaileysWhatsappClient implements WhatsappClient {
  public _phone: string = "";
  private _messageQueue: Bottleneck;
  public _reconnectAttempts: number = 0;
  public _lastReconnectTime: number = 0;

  constructor(
    public sessionId: string,
    public clientId: number,
    public instance: string,
    public _storage: DataClient,
    public _sock: ReturnType<typeof makeWASocket>,
    public _ev: WppEventEmitter,
  ) {
    // Configurar limitador de taxa para prevenir bloqueios do WhatsApp
    // Limites configuráveis via variáveis de ambiente
    const messagesPerHour = parseInt(process.env["WA_MESSAGES_PER_HOUR"] || "300", 10);
    const minTimeBetweenMessages = parseInt(process.env["WA_MIN_TIME_BETWEEN_MESSAGES"] || "3000", 10);

    this._messageQueue = new Bottleneck({
      reservoir: messagesPerHour, // Máximo de mensagens por hora (configurável)
      reservoirRefreshAmount: messagesPerHour,
      reservoirRefreshInterval: 60 * 60 * 1000, // 1 hora em ms
      maxConcurrent: 1, // Processar uma mensagem por vez
      minTime: minTimeBetweenMessages, // Mínimo de tempo entre mensagens (configurável)
    });

    // Log de eventos da fila para monitoramento
    this._messageQueue.on("failed", (error) => {
      console.error(`[Queue ${this.sessionId}] Job failed:`, error);
    });

    this._messageQueue.on("depleted", () => {
      console.log(`[Queue ${this.sessionId}] Reservoir depleted, waiting for refresh...`);
    });
  }

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
    this._sock.ev.on("contacts.upsert", this.onContactsUpsert.bind(this));
  }

  private getLogger(processName: string, processId: string, input: unknown, debug: boolean = false): ProcessingLogger {
    return new ProcessingLogger(this._storage, this.instance, processName, processId, input, debug);
  }

  private async onConnectionUpdate(update: Partial<ConnectionState>) {
    const processId = `conn-update-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const logger = this.getLogger("Connection Update", processId, update);
    try {
      await handleConnectionUpdate({ update, client: this, logger });
    } catch (error) {
      logger.failed(error);
    }
  }

  private async onMessagesUpsert({ messages, type }: { messages: WAMessage[]; type: MessageUpsertType }) {
    const processId = `messages-upsert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const logger = this.getLogger("Messages Upsert", processId, { type, messageCount: messages.length });
    try {
      await handleMessageUpsert({ messages, type, client: this, logger });
    } catch (error) {
      logger.failed(error);
    }
  }

  private async onMessagesUpdate(updates: WAMessageUpdate[]) {
    const processId = `messages-update-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const logger = this.getLogger("Messages Update", processId, { updateCount: updates.length });
    try {
      await handleMessageUpdate({ updates, client: this, logger });
    } catch (error) {
      logger.failed(error);
    }
  }

  private async onHistorySet({ messages, contacts, isLatest }: { messages: WAMessage[]; contacts: Contact[]; isLatest?: boolean }) {
    const processId = `history-set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const logger = this.getLogger("History Set", processId, { messageCount: messages.length, isLatest }, true);
    try {
      await handleHistorySet({ client: this, messages, contacts, isLatest: !!isLatest, logger });
    } catch (error) {
      logger.failed(error);
    }
  }

  /**
   * Captura o evento contacts.upsert da Baileys para armazenar mapeamentos LID -> Phone Number.
   * Contatos podem vir com { id: "5511999@s.whatsapp.net", lid: "148309633146897@lid" }
   * ou { id: "148309633146897@lid", phoneNumber: "5511999@s.whatsapp.net" }
   */
  private async onContactsUpsert(contacts: Contact[]) {
    handleContactsUpsert({ client: this, contacts });
  }

  public isValidWhatsapp(phone: string): Promise<boolean> {
    const processId = `validate-whatsapp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const logger = this.getLogger("Validate WhatsApp", processId, { phone });

    logger.log(`Checking if phone number is valid WhatsApp: ${phone}`);
    throw new Error("Method not implemented.");
  }

  public async sendMessage(props: SendMessageOptions, isGroup: boolean = false): Promise<MessageDto> {
    const processId = `send-message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const logger = this.getLogger("Send Message", processId, { props, isGroup });

    // Enfileirar mensagem para evitar rate limiting
    return this._messageQueue.schedule(async () => {
      try {
        logger.log("Mensagem saindo da fila para processamento");
        return await handleSendMessage({ client: this, options: props, isGroup, logger });
      } catch (error) {
        logger.failed(error);
        throw error;
      }
    });
  }

  public async editMessage(props: EditMessageOptions): Promise<MessageDto> {
    const processId = `edit-message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const logger = this.getLogger("Edit Message", processId, { props });
    try {
      return await handleEditMessage({ client: this, options: props, logger });
    } catch (error) {
      logger.failed(error);
      throw error;
    }
  }

  public async getAvatarUrl(phone: string): Promise<string | null> {
    const processId = `get-avatar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
