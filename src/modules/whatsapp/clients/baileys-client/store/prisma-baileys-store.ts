import { BaileysEventEmitter, BaileysEventMap, Chat, Contact, GroupMetadata, proto, WAMessage, WAMessageKey } from "baileys";
import onlyDigits from "../../../../../helpers/only-digits";
import { RawContact, RawGroupMetadata, RawMessage } from "../../../types";
import BaileysWhatsappClient from "../baileys-whatsapp-client";
import { extractLidFromKey } from "../helpers/extract-lid-from-key";
import { extractPhoneFromKey } from "../helpers/extract-phone-from-key";
import shouldIgnoreMessage from "../helpers/should-ignore-message";
import { MessageFile, MessageUpdateEvent, MessageUpsertEvent } from "../types";
import BaileysStore, { GetMessagesByChatOptions } from "./baileys-store";
import RawContactRepository, { UpdateRawContactInput } from "./repositories/raw-contact-repository";
import RawGroupMetadataRepository from "./repositories/raw-group-metadata-repository";
import RawMessageFileRepository from "./repositories/raw-message-file-repository";
import RawMessageRepository from "./repositories/raw-message-repository";
import MediaService from "./services/media-service";

class PrismaBaileysStore implements BaileysStore {
  private client: BaileysWhatsappClient | null = null;
  private readonly rawMessageRepository: RawMessageRepository;
  private readonly rawContactRepository: RawContactRepository;
  private readonly rawGroupMetadataRepository: RawGroupMetadataRepository;
  private readonly mediaService: MediaService;

  constructor(
    private readonly instance: string,
    private readonly sessionId: string,
    private readonly clientId: number,
  ) {
    this.rawMessageRepository = new RawMessageRepository(this.sessionId, this.instance);
    this.rawContactRepository = new RawContactRepository(this.sessionId, this.instance);
    this.rawGroupMetadataRepository = new RawGroupMetadataRepository(this.sessionId, this.instance);
    this.mediaService = new MediaService(
      this.instance,
      this.sessionId,
      new RawMessageFileRepository(),
    );
  }

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

      await this.rawMessageRepository.upsert({
        id: data.key.id!,
        timestamp: String(data.messageTimestamp),
        remoteJid: data.key.remoteJid!,
        keyData: data.key,
        messageData: data.message || {},
        useBufferJSON: true,
      });
    }
  }

  private async handleMessagesUpdate(updates: MessageUpdateEvent) {
    for (const update of updates) {
      const existing = await this.rawMessageRepository.findById(update.key.id!);

      if (!existing) continue;

      console.log("Updating message in store:", update.key.id);
      console.log("Update data:", update.update);
      console.log(`Existing data <${typeof existing.messageData}>:`, existing);

      const messageData = typeof existing.messageData === "object" ? existing.messageData as proto.IMessage : {};
      const updatedMessageData = { ...messageData, ...update.update.message };

      await this.rawMessageRepository.updateMessageData(update.key.id!, updatedMessageData);
    }
  }

  private async handleHistorySet(data: BaileysEventMap["messaging-history.set"]) {
    console.log(`[Store] History set received: ${data.messages.length} messages, ${data.chats?.length || 0} chats, ${data.contacts?.length || 0} contacts`);

    // Processar mensagens do histórico
    for (const message of data.messages) {
      if (shouldIgnoreMessage(message)) continue;

      await this.rawMessageRepository.upsert({
        id: message.key.id!,
        timestamp: String(message.messageTimestamp),
        remoteJid: message.key.remoteJid!,
        keyData: message.key,
        messageData: message.message || {},
        useBufferJSON: false,
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

    for (const contact of contacts) {
      if (!contact.id) continue;

      const existing = await this.rawContactRepository.findById(contact.id);

      if (!existing) continue;

      const data: UpdateRawContactInput = {};

      if (typeof contact.name !== "undefined") data.name = contact.name;
      if (typeof contact.notify !== "undefined") data.notify = contact.notify;
      if (typeof contact.verifiedName !== "undefined") data.verifiedName = contact.verifiedName;
      if (typeof contact.imgUrl !== "undefined") data.imgUrl = contact.imgUrl;
      if (typeof contact.status !== "undefined") data.status = contact.status;

      const phoneNumber = this.extractPhoneNumber(contact.id);
      if (phoneNumber) {
        data.phoneNumber = phoneNumber;
      }

      if (Object.keys(data).length === 0) continue;

      await this.rawContactRepository.updateById(existing.id, data);
    }
  }

  private async handleContactsUpsert(contacts: Contact[]) {
    console.log(`[Store] Contacts upsert: ${contacts.length} contacts`);

    for (const contact of contacts) {
      const phoneNumber = this.extractPhoneNumber(contact.id);

      await this.rawContactRepository.upsert({
        id: contact.id,
        phoneNumber,
        name: contact.name || null,
        notify: contact.notify || null,
        verifiedName: contact.verifiedName || null,
        imgUrl: contact.imgUrl || null,
        status: contact.status || null,
      });
    }
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

      const existing = await this.rawGroupMetadataRepository.findByRemoteJid(group.id);

      if (!existing) continue;

      const existingMetadata = JSON.parse(existing.metadata as string) as GroupMetadata;
      const updatedMetadata = { ...existingMetadata, ...group };

      await this.rawGroupMetadataRepository.updateMetadata(existing.id, updatedMetadata);
    }
  }

  private async handleGroupsUpsert(groups: GroupMetadata[]) {
    console.log(`[Store] Groups upsert: ${groups.length} groups`);

    for (const group of groups) {
      await this.rawGroupMetadataRepository.upsert(group);
    }
  }

  public async getMessage(id: string): Promise<RawMessage> {
    const message = await this.rawMessageRepository.findById(id);

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
    const messages = await this.rawMessageRepository.findMany(startTime, endTime);

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
    const messages = await this.rawMessageRepository.findMany(options.startTime, options.endTime, options.jid);

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
    const group = await this.rawGroupMetadataRepository.findByRemoteJid(jid);

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
    const groups = await this.rawGroupMetadataRepository.findMany();

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
    const contacts = await this.rawContactRepository.findMany();

    return contacts.map((contact) => this.rawContactRepository.mapToRawContact(contact));
  }

  public async getChats(): Promise<Chat[]> {
    return [];
  }

  public async getContactByLid(_jid: string): Promise<RawContact | null> {
    const possibleIds = _jid.includes("@") ? [_jid] : [_jid, `${_jid}@lid`];

    const contact = await this.rawContactRepository.findByPossibleIds(possibleIds);

    if (!contact) {
      return null;
    }

    return this.rawContactRepository.mapToRawContact(contact);
  }

  public async getContactByPhone(_phone: string): Promise<RawContact | null> {
    const normalizedPhone = onlyDigits(_phone);

    if (!normalizedPhone) {
      return null;
    }

    const contact = await this.rawContactRepository.findByPhone(normalizedPhone);

    if (!contact) {
      return null;
    }

    return this.rawContactRepository.mapToRawContact(contact);
  }

  public async getContactByKey(_key: WAMessageKey): Promise<RawContact | null> {
    const lid = extractLidFromKey(_key);

    if (lid) {
      const lidContact = await this.getContactByLid(lid);
      if (lidContact) {
        return lidContact;
      }
    }

    const phone = extractPhoneFromKey(_key);

    if (phone) {
      return this.getContactByPhone(phone);
    }

    return null;
  }

  private extractPhoneNumber(jid: string): string {
    const localPart = jid.split("@")[0] || "";
    return onlyDigits(localPart);
  }

  public setClient(client: BaileysWhatsappClient): void {
    this.client = client;
  }

  public async getOrDownloadMessageMedia(message: WAMessage): Promise<MessageFile> {
    return this.mediaService.getOrDownloadMessageMedia(message);
  }
}

export default PrismaBaileysStore;