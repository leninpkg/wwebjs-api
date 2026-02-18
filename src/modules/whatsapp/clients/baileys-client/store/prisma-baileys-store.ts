import { BaileysEventEmitter, Chat, Contact, GroupMetadata, WAMessageKey } from "baileys";
import { RawMessage } from "../../../../../generated/prisma/client";
import { MessageUpsertEvent } from "../types";
import BaileysStore, { GetMessagesByChatOptions } from "./baileys-store";
import { prisma } from "../../../../../prisma";
import shouldIgnoreMessage from "../helpers/should-ignore-message";

class PrismaBaileysStore implements BaileysStore {
  constructor(
    private readonly instance: string,
    private readonly sessionId: string,
  ) { }

  private async handleMessagesUpsert({ messages, type, requestId }: MessageUpsertEvent) {
    for (const message of messages) {
      if (shouldIgnoreMessage(message)) continue;

      await prisma.rawMessage.upsert({
        where: { id: message.key.id! },
        create: {
          id: message.key.id!,
          instance: this.instance,
          timestamp: String(message.messageTimestamp),
          remoteJid: message.key.remoteJid!,
          sessionId: this.sessionId,
          keyData: JSON.stringify(message.key),
          messageData: JSON.stringify(message.message),
        },
        update: {
          keyData: JSON.stringify(message.key),
          messageData: JSON.stringify(message.message),
        }
      })
    }
  }


  public bind(ev: BaileysEventEmitter): void {
    ev.on("messages.upsert", this.handleMessagesUpsert.bind(this));
    throw new Error("Method not implemented.");
  }
  public async getMessage(id: string): Promise<RawMessage> {
    throw new Error("Method not implemented.");
  }

  public async getMessages(startTime?: Date, endTime?: Date): Promise<RawMessage[]> {
    throw new Error("Method not implemented.");
  }
  public async getMessagesByChat(options: GetMessagesByChatOptions): Promise<RawMessage[]> {
    throw new Error("Method not implemented.");
  }
  public async getGroups(): Promise<GroupMetadata[]> {
    throw new Error("Method not implemented.");
  }
  public async getContacts(): Promise<Contact[]> {
    throw new Error("Method not implemented.");
  }
  public async getChats(): Promise<Chat[]> {
    throw new Error("Method not implemented.");
  }
  public async getContactByJid(jid: string): Promise<Contact | null> {
    throw new Error("Method not implemented.");
  }
  public async getContactByPhone(phone: string): Promise<Contact | null> {
    throw new Error("Method not implemented.");
  }
  public async getContactByKey(key: WAMessageKey): Promise<Contact | null> {
    throw new Error("Method not implemented.");
  }
}

export default PrismaBaileysStore;