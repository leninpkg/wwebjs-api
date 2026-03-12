import { isJidGroup, proto, WAMessage, WAMessageKey } from "baileys";
import onlyDigits from "../../../../../helpers/only-digits";
import filesService from "../../../../files/files.service";
import InpulseMessage, { InpulseMessageStatus } from "../../../inpulse-types";
import { extractLidFromKey } from "../helpers/extract-lid-from-key";
import { extractMessageData } from "../helpers/extract-message-data";
import { extractPhoneFromKey } from "../helpers/extract-phone-from-key";
import BaileysStore from "../store/baileys-store";
import { RawMessage } from "../types";

export type BaileysMessage = WAMessage | {
  key: proto.IMessageKey;
  message: proto.IMessage;
  messageTimestamp: string;
}

interface ToInpulseMessageOptions {
  instance: string;
  clientId: number;
  store: BaileysStore;
  clientPhone: string;
}

interface ToRawMessageOptions {
  instance: string;
  sessionId: string;
}

interface GetMessageContactNameOptions {
  key: WAMessageKey;
  store: BaileysStore;
}

class BaileysMessageAdapter {
  private readonly _message: BaileysMessage;

  public constructor(message: BaileysMessage) {
    this._message = message;
  }

  public get original(): BaileysMessage {
    return this._message;
  }

  public toRawMessage({ sessionId, instance }: ToRawMessageOptions): RawMessage {
    if (!this._message.message) {
      throw new Error("Message does not have message content");
    }

    return {
      id: this.getMessageId(),
      instance,
      sessionId,
      remoteJid: this.getChatId(),
      timestamp: String(this._message.messageTimestamp),
      keyData: this._message.key,
      messageData: this._message.message,
    }
  }

  public async toInpulseMessage({ clientPhone, clientId, store, instance }: ToInpulseMessageOptions): Promise<InpulseMessage> {
    const remotePhone = await this.getRemotePhone(store);
    const remoteLid = await this.getRemoteLid(store);
    const fromMe = remotePhone === clientPhone;
    const chatId = this.getChatId();
    const { isFile, ...content } = extractMessageData(this._message.message!);
    const sentAt = this.getMessageDate();

    if (!remotePhone && !remoteLid) {
      throw new Error("Could not extract remote phone or lid from message");
    }

    const remote = remoteLid || remotePhone!;
    const key = this._message.key;

    const message: InpulseMessage = {
      instance,
      clientId,
      wwebjsIdStanza: this.getMessageId(),
      from: fromMe ? `me:${clientPhone}` : remote,
      to: fromMe ? remote : `me:${clientPhone}`,
      isForwarded: this.getIsForwarded(this._message.message || {}),
      isGroup: isJidGroup(chatId) || false,
      groupId: chatId.replace("@g.us", "") || null,
      status: this.getMessageStatus(fromMe),
      authorName: await this.getMessageContactName({ key, store }),
      timestamp: String(sentAt.getTime()),
      sentAt: sentAt,
      quotedId: this.getQuotedMessageId(),
      ...content,
    }

    if (isFile && "category" in this._message) {
      const { media, success, } = await store.getMessageMedia(this._message);

      if (success) {
        const mediaData = await filesService.fetchFileMetadata(media.inpulseId);
        message.fileId = media.inpulseId;
        message.fileSize = String(mediaData.size);
        message.fileName = mediaData.name;
        message.fileType = mediaData.mime_type;
        return message;
      }

      throw new Error("Message is marked as file but media could not be retrieved. Cannot download media.");
    }

    if (isFile && !("category" in this._message)) {
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

  private async getRemotePhone(store: BaileysStore): Promise<string | null> {
    // Try to get the phone number from the message key
    const phoneFromKey = extractPhoneFromKey(this._message.key);
    if (phoneFromKey) {
      return phoneFromKey;
    }
    // If that fails, try to get it from the store
    const contact = await store.getContactByKey(this._message.key);
    if (contact?.phone) {
      return onlyDigits(contact.phone);
    }
    return null;
  }

  private async getRemoteLid(store: BaileysStore): Promise<string | null> {
    const lidFromKey = extractLidFromKey(this._message.key);
    if (lidFromKey) {
      return lidFromKey;
    }
    const contact = await store.getContactByKey(this._message.key);
    return contact?.id || null;
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

  private async getMessageContactName({ key, store }: GetMessageContactNameOptions): Promise<string | null> {
    const contact = await store.getContactByKey(key);

    if (contact?.name || contact?.verifiedName) {
      return contact.name || contact.verifiedName!;
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

  private getQuotedMessageId(): string | null {
    if (!this._message.message) {
      return null;
    }

    const contextInfo = this._message.message.extendedTextMessage?.contextInfo;
    if (contextInfo?.quotedMessage) {
      return contextInfo.stanzaId || null;
    }
    return null;
  }
}
export default BaileysMessageAdapter;