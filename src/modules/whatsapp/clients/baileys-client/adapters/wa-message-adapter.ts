import { isJidGroup, proto, WAMessage, WAMessageKey } from "baileys";
import onlyDigits from "../../../../../helpers/only-digits";
import InpulseMessage, { InpulseMessageStatus } from "../../../inpulse-types";
import { RawMessage } from "../../../types";
import { extractMessageData, FileMessageContent } from "../helpers/extract-message-data";
import { extractPhoneFromKey } from "../helpers/extract-phone-from-key";
import saveMessageMedia from "../helpers/save-message-media";
import BaileysStore from "../store/baileys-store";

type BaileysMessage = WAMessage | {
  key: proto.IMessageKey;
  message: proto.IMessage;
  messageTimestamp: string;
}

// Adicionar handler para arquivos de mensagens antigas (toInpulseMessage)
// Adicionar hanlder para status de mensagens antigas (getMessageStatus)
class BaileysMessageAdapter {
  public constructor(
    private readonly _instance: string,
    private readonly _clientId: number,
    private readonly _sessionId: string,
    private readonly _phone: string,
    private readonly _message: BaileysMessage,
    private readonly _store: BaileysStore
  ) { }

  public get original(): BaileysMessage {
    return this._message;
  }

  public toRawMessage(): RawMessage {
    return {
      id: this.getMessageId(),
      instance: this._instance,
      sessionId: this._sessionId,
      remoteJid: this.getChatId(),
      timestamp: String(this._message.messageTimestamp),
      keyData: this._message.key,
      messageData: this._message.message || {},
    }
  }

  public async toInpulseMessage(): Promise<InpulseMessage> {
    const remotePhone = await this.getRemotePhone();
    const fromMe = remotePhone === this._phone;
    const chatId = this.getChatId();
    const { isFile, ...content } = extractMessageData(this._message.message!);
    const sentAt = this.getMessageDate();

    const message: InpulseMessage = {
      instance: this._instance,
      clientId: this._clientId,
      wwebjsIdStanza: this.getMessageId(),
      from: fromMe ? this._phone : remotePhone,
      to: fromMe ? remotePhone : this._phone,
      isForwarded: this.getIsForwarded(this._message.message || {}),
      isGroup: isJidGroup(chatId) || false,
      groupId: chatId.replace("@g.us", "") || null,
      status: this.getMessageStatus(fromMe),
      authorName: await this.getMessageContactName(this._message.key),
      timestamp: String(sentAt.getTime()),
      sentAt: sentAt,
      ...content,
    }

    if (isFile && "category" in this._message) {
      const { fileName, fileType } = content as FileMessageContent;
      const file = await saveMessageMedia(this._message, fileName, fileType, this._instance);
      message.fileId = file.id;
      message.fileSize = String(file.size);
    }
    if (isFile && !("category" in this._message)) {
      // Mensagem não é WAMessage, adicionar handler para baixar mídia de mensagens antigas
      throw new Error("Message is marked as file but does not have a category. Cannot download media.");
    }

    return message;
  }

  private getChatId(): string {
    if (this._message.key.remoteJid) {
      return this._message.key.remoteJid;
    }
    throw new Error("Message does not have a remoteJid");
  }

  private getMessageId(): string {
    if (this._message.key.id) {
      return this._message.key.id;
    }
    throw new Error("Message does not have an id");
  }

  private async getRemotePhone(): Promise<string> {
    // Try to get the phone number from the message key
    const phoneFromKey = extractPhoneFromKey(this._message.key);
    if (phoneFromKey) {
      return phoneFromKey;
    }
    // If that fails, try to get it from the store
    const contact = await this._store.getContactByKey(this._message.key);
    if (contact?.phoneNumber) {
      return onlyDigits(contact.phoneNumber);
    }
    // If that also fails, throw an error
    throw new Error("Could not determine the phone number from the message key or store");
  }

  private getIsForwarded(message: proto.IMessage): boolean {
    return message?.extendedTextMessage?.contextInfo?.isForwarded || false;
  }

  private getMessageStatus(fromMe: boolean): InpulseMessageStatus {
    if ("status" in this._message && this._message.status) {
      switch (this._message.status) {
        case proto.WebMessageInfo.Status.PENDING:
          return "PENDING";
        case proto.WebMessageInfo.Status.SERVER_ACK:
          return "SENT";
        case proto.WebMessageInfo.Status.DELIVERY_ACK:
          return "RECEIVED";
        case proto.WebMessageInfo.Status.READ:
        case proto.WebMessageInfo.Status.PLAYED:
          return "READ";
        default:
          break;
      }
    }
    return fromMe ? "SENT" : "RECEIVED";
  }

  private async getMessageContactName(key: WAMessageKey): Promise<string | null> {
    const contact = await this._store.getContactByKey(key);

    if (contact?.name || contact?.verifiedName) {
      return contact.name || contact.verifiedName || null;
    }
    if ("verifiedBizName" in this._message && this._message.verifiedBizName) {
      return this._message.verifiedBizName;
    }
    if ("pushName" in this._message && this._message.pushName) {
      return this._message.pushName;
    }

    return null;
  }

  private getMessageDate(): Date {
    const timestamp = this._message.messageTimestamp;

    if (!timestamp) {
      throw new Error("Message does not have a timestamp");
    }
    const timestampMs = parseInt(timestamp.toString().padEnd(13, "0"));
    return new Date(timestampMs);
  }
}

export default BaileysMessageAdapter;