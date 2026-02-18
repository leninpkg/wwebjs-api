import { BaileysEventEmitter, BaileysEventMap, BufferJSON, Chat, Contact, GroupMetadata, proto, WAMessageKey } from "baileys";
import { prisma } from "../../../../../prisma";
import { RawContact, RawGroupMetadata, RawMessage } from "../../../types";
import BaileysMessageAdapter from "../adapters/baileys-message-adapter";
import BaileysWhatsappClient from "../baileys-whatsapp-client";
import { extractMessageType } from "../helpers/get-message-type";
import shouldIgnoreMessage from "../helpers/should-ignore-message";
import { MessageUpdateEvent, MessageUpsertEvent } from "../types";
import BaileysStore, { GetMessagesByChatOptions } from "./baileys-store";

class PrismaBaileysStore implements BaileysStore {
  private client: BaileysWhatsappClient | null = null;

  constructor(
    private readonly instance: string,
    private readonly sessionId: string,
    private readonly clientId: number,
  ) { }

  public bind(ev: BaileysEventEmitter): void {
    ev.on("messages.upsert", this.handleMessagesUpsert.bind(this));
    ev.on("messages.update", this.handleMessagesUpdate.bind(this));
    ev.on("messaging-history.set", this.handleHistorySet.bind(this));
    ev.on("contacts.update", this.handleContactsUpdate.bind(this));
    ev.on("contacts.upsert", this.handleContactsUpsert.bind(this));
    ev.on("chats.upsert", this.handleChatsUpsert.bind(this));
    ev.on("chats.update", this.handleChatsUpdate.bind(this));
    ev.on("groups.update", this.handleGroupsUpdate.bind(this));
    ev.on("groups.upsert", this.handleGroupsUpsert.bind(this));
  }

  private async handleMessagesUpsert({ messages }: MessageUpsertEvent) {
    for (const data of messages) {
      if (shouldIgnoreMessage(data) || !data.message) continue;

      const type = extractMessageType(data.message);
      const adapted = new BaileysMessageAdapter(this.instance, this.clientId, this.sessionId, this.client!.phone, data, this);


      await prisma.rawMessage.upsert({
        where: { id: data.key.id! },
        create: {
          id: data.key.id!,
          instance: this.instance,
          timestamp: String(data.messageTimestamp),
          remoteJid: data.key.remoteJid!,
          sessionId: this.sessionId,
          keyData: JSON.stringify(data.key, BufferJSON.replacer),
          messageData: JSON.stringify(data.message || {}, BufferJSON.replacer),
        },
        update: {
          keyData: JSON.stringify(data.key, BufferJSON.replacer),
          messageData: JSON.stringify(data.message || {}, BufferJSON.replacer),
        }
      })
    }
  }

  private async handleMessagesUpdate(updates: MessageUpdateEvent) {
    for (const update of updates) {
      const existing = await prisma.rawMessage.findUnique({
        where: { id: update.key.id! },
      });

      if (!existing) continue;

      console.log("Updating message in store:", update.key.id);
      console.log("Update data:", update.update);
      console.log(`Existing data <${typeof existing.messageData}>:`, existing);

      const messageData = typeof existing.messageData === "object" ? existing.messageData as proto.IMessage : {};
      const updatedMessageData = { ...messageData, ...update.update.message };

      await prisma.rawMessage.update({
        where: { id: update.key.id! },
        data: {
          messageData: JSON.stringify(updatedMessageData),
        }
      });
    }
  }

  private async handleHistorySet(data: BaileysEventMap["messaging-history.set"]) {
    console.log(`[Store] History set received: ${data.messages.length} messages, ${data.chats?.length || 0} chats, ${data.contacts?.length || 0} contacts`);

    // Processar mensagens do histórico
    for (const message of data.messages) {
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
          messageData: JSON.stringify(message.message || {}),
        },
        update: {
          keyData: JSON.stringify(message.key),
          messageData: JSON.stringify(message.message || {}),
        }
      });
    }

    if (data.contacts && data.contacts.length > 0) {
      await this.handleContactsUpsert(data.contacts);
    }

    if (data.chats && data.chats.length > 0) {
      await this.handleChatsUpsert(data.chats);
    }

    console.log(`[Store] History set processed successfully`);
  }

  private async handleContactsUpdate(contacts: Partial<Contact>[]) {
    console.log(`[Store] Contacts update: ${contacts.length} contacts`);
    // TODO: Implementar quando houver tabela de contatos
  }

  private async handleContactsUpsert(contacts: Contact[]) {
    console.log(`[Store] Contacts upsert: ${contacts.length} contacts`);
    // TODO: Implementar quando houver tabela de contatos
  }

  private async handleChatsUpsert(chats: Chat[]) {
    console.log(`[Store] Chats upsert: ${chats.length} chats`);
    // TODO: Implementar quando houver tabela de chats
  }

  private async handleChatsUpdate(updates: Partial<Chat>[]) {
    console.log(`[Store] Chats update: ${updates.length} chats`);
    // TODO: Implementar quando houver tabela de chats
  }

  private async handleGroupsUpdate(groups: Partial<GroupMetadata>[]) {
    console.log(`[Store] Groups update: ${groups.length} groups`);

    for (const group of groups) {
      if (!group.id) continue;

      const existing = await prisma.rawGroupMetadata.findFirst({
        where: {
          remoteJid: group.id,
          sessionId: this.sessionId,
          instance: this.instance,
        },
      });

      if (!existing) continue;

      const existingMetadata = JSON.parse(existing.metadata as string) as GroupMetadata;
      const updatedMetadata = { ...existingMetadata, ...group };

      await prisma.rawGroupMetadata.update({
        where: { id: existing.id },
        data: {
          metadata: JSON.stringify(updatedMetadata),
        },
      });
    }
  }

  private async handleGroupsUpsert(groups: GroupMetadata[]) {
    console.log(`[Store] Groups upsert: ${groups.length} groups`);

    for (const group of groups) {
      await prisma.rawGroupMetadata.upsert({
        where: {
          id: `${this.sessionId}-${group.id}`,
        },
        create: {
          id: `${this.sessionId}-${group.id}`,
          remoteJid: group.id,
          instance: this.instance,
          sessionId: this.sessionId,
          metadata: JSON.stringify(group),
        },
        update: {
          metadata: JSON.stringify(group),
        },
      });
    }
  }

  public async getMessage(id: string): Promise<RawMessage> {
    const message = await prisma.rawMessage.findUnique({
      where: { id },
    });

    if (!message) {
      throw new Error(`Message with id ${id} not found`);
    }

    return {
      id: message.id,
      instance: message.instance,
      sessionId: message.sessionId,
      remoteJid: message.remoteJid,
      timestamp: message.timestamp,
      keyData: JSON.parse(message.keyData as string) as proto.IMessageKey,
      messageData: JSON.parse(message.messageData as string) as proto.IMessage,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  public async getMessages(startTime?: Date, endTime?: Date): Promise<RawMessage[]> {
    const where: any = {
      sessionId: this.sessionId,
      instance: this.instance,
    };

    if (startTime || endTime) {
      where.timestamp = {};
      if (startTime) {
        where.timestamp.gte = String(startTime.getTime());
      }
      if (endTime) {
        where.timestamp.lte = String(endTime.getTime());
      }
    }

    const messages = await prisma.rawMessage.findMany({
      where,
      orderBy: { timestamp: "asc" },
    });

    return messages.map((msg) => ({
      id: msg.id,
      instance: msg.instance,
      sessionId: msg.sessionId,
      remoteJid: msg.remoteJid,
      timestamp: msg.timestamp,
      keyData: JSON.parse(msg.keyData as string) as proto.IMessageKey,
      messageData: JSON.parse(msg.messageData as string) as proto.IMessage,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    }));
  }

  public async getMessagesByChat(options: GetMessagesByChatOptions): Promise<RawMessage[]> {
    const where: any = {
      sessionId: this.sessionId,
      instance: this.instance,
      remoteJid: options.jid,
    };

    if (options.startTime || options.endTime) {
      where.timestamp = {};
      if (options.startTime) {
        where.timestamp.gte = String(options.startTime.getTime());
      }
      if (options.endTime) {
        where.timestamp.lte = String(options.endTime.getTime());
      }
    }

    const messages = await prisma.rawMessage.findMany({
      where,
      orderBy: { timestamp: "asc" },
    });

    return messages.map((msg) => ({
      id: msg.id,
      instance: msg.instance,
      sessionId: msg.sessionId,
      remoteJid: msg.remoteJid,
      timestamp: msg.timestamp,
      keyData: JSON.parse(msg.keyData as string) as proto.IMessageKey,
      messageData: JSON.parse(msg.messageData as string) as proto.IMessage,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    }));
  }

  public async getGroup(jid: string): Promise<RawGroupMetadata | null> {
    const group = await prisma.rawGroupMetadata.findFirst({
      where: {
        remoteJid: jid,
        sessionId: this.sessionId,
        instance: this.instance,
      },
    });

    if (!group) {
      return null;
    }

    return {
      id: group.id,
      instance: group.instance,
      sessionId: group.sessionId,
      remoteJid: group.remoteJid,
      groupMetadata: JSON.parse(group.metadata as string) as GroupMetadata,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }

  public async getGroups(): Promise<RawGroupMetadata[]> {
    const groups = await prisma.rawGroupMetadata.findMany({
      where: {
        sessionId: this.sessionId,
        instance: this.instance,
      },
    });

    return groups.map((group) => ({
      id: group.id,
      instance: group.instance,
      sessionId: group.sessionId,
      remoteJid: group.remoteJid,
      groupMetadata: JSON.parse(group.metadata as string) as GroupMetadata,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    }));
  }

  public async getContacts(): Promise<RawContact[]> {
    const contacts = await prisma.rawContact.findMany({
      where: {
        sessionId: this.sessionId,
        instance: this.instance,
      }
    });

    return contacts.map((contact) => ({
      id: contact.id,
      instance: contact.instance,
      sessionId: contact.sessionId,
      avatarUrl: contact.imgUrl,
      name: contact.name,
      phone: contact.phoneNumber,
      verifiedName: contact.verifiedName,
      rawData: contact as Contact
    }));
  }

  public async getChats(): Promise<Chat[]> {
    return [];
  }

  public async getContactByLid(_jid: string): Promise<RawContact | null> {
    throw new Error("Method not implemented.");
  }

  public async getContactByPhone(_phone: string): Promise<RawContact | null> {
    throw new Error("Method not implemented.");
  }

  public async getContactByKey(_key: WAMessageKey): Promise<RawContact | null> {
    throw new Error("Method not implemented.");
  }

  public setClient(client: BaileysWhatsappClient): void {
    this.client = client;
  }
}

export default PrismaBaileysStore;