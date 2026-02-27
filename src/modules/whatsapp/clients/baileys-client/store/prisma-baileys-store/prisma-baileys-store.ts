import { BaileysEventEmitter, BaileysEventMap, Chat, Contact, GroupMetadata, proto, WAMessage, WAMessageKey } from "baileys";
import onlyDigits from "../../../../../../helpers/only-digits";
import { extractLidFromKey } from "../../helpers/extract-lid-from-key";
import { extractPhoneFromKey } from "../../helpers/extract-phone-from-key";
import { PrismaLogger } from "../../logger/prisma-logger";
import { MessageFile, MessageUpdateEvent, MessageUpsertEvent, RawContact, RawGroupMetadata, RawMessage } from "../../types";
import BaileysStore, { GetMessagesByChatOptions } from "../baileys-store";
import ContactsRepository from "./contacts/contacts-repository";
import updateContact from "./contacts/update-contact";
import upsertContact from "./contacts/upsert-contact";
import MessagesRepository from "./messages/messages-repository";
import RawGroupMetadataRepository from "./repositories/raw-group-metadata-repository";
import RawMessageFileRepository from "./repositories/raw-message-file-repository";
import MediaService from "./services/media-service";
import upsertMessage from "./messages/upsert-message";
import updateMessage from "./messages/update-message";

class PrismaBaileysStore implements BaileysStore {
  private readonly messagesRepository: MessagesRepository;
  private readonly contactsRepository: ContactsRepository;
  private readonly rawGroupMetadataRepository: RawGroupMetadataRepository;
  private readonly mediaService: MediaService;
  private readonly emitterName = "WppStore";

  constructor(
    private readonly instance: string,
    private readonly sessionId: string,
    private readonly logger: PrismaLogger
  ) {
    this.messagesRepository = new MessagesRepository(this.sessionId, this.instance);
    this.contactsRepository = new ContactsRepository(this.sessionId, this.instance);
    this.rawGroupMetadataRepository = new RawGroupMetadataRepository(this.sessionId, this.instance);
    this.mediaService = new MediaService(
      this.instance,
      this.sessionId,
      new RawMessageFileRepository(),
    );
  }

  private getLogger(operationName: string) {
    const now = Date.now();
    const id = `${this.sessionId}:${operationName}:${now}`;
    return this.logger.getCorrelatedLogger(this.emitterName, operationName, id);
  }

  public bind(ev: BaileysEventEmitter): void {
    ev.on("messaging-history.set", this.handleHistorySet.bind(this));
    ev.on("contacts.upsert", this.handleContactsUpsert.bind(this));
    ev.on("contacts.update", this.handleContactsUpdate.bind(this));
    ev.on("messages.upsert", this.handleMessagesUpsert.bind(this));
    ev.on("messages.update", this.handleMessagesUpdate.bind(this));
    //ev.on("chats.upsert", this.handleChatsUpsert.bind(this));
    //ev.on("chats.update", this.handleChatsUpdate.bind(this));
    //ev.on("groups.update", this.handleGroupsUpdate.bind(this));
    //ev.on("groups.upsert", this.handleGroupsUpsert.bind(this));
  }

  private async handleMessagesUpsert({ messages }: MessageUpsertEvent) {
    const logger = this.getLogger("hMsgUpsert");
    for (const message of messages) {
      await upsertMessage({ logger, message, repository: this.messagesRepository });
    }
  }

  private async handleMessagesUpdate(updates: MessageUpdateEvent) {
    const logger = this.getLogger("hMsgUpdate");
    for (const update of updates) {
      await updateMessage({ logger, update, repository: this.messagesRepository });
    }
  }

  private async handleHistorySet(data: BaileysEventMap["messaging-history.set"]) {
    console.log(`[Store] History set received: ${data.messages.length} messages, ${data.chats?.length || 0} chats, ${data.contacts?.length || 0} contacts`);

    /* for (const message of data.messages) {
      if (shouldIgnoreMessage(message)) continue;

      await this.rawMessageRepository.upsert({
        id: message.key.id!,
        timestamp: String(message.messageTimestamp),
        remoteJid: message.key.remoteJid!,
        keyData: message.key,
        messageData: message.message || {},
      });
    } */
    await this.handleContactsUpsert(data.contacts);
    //await this.handleChatsUpsert(data.chats);

    console.log(`[Store] History set processed successfully`);
  }

  private async handleContactsUpdate(contacts: Partial<Contact>[]) {
    const logger = this.getLogger("hCttUpdate");
    for (const contact of contacts) {
      await updateContact({ logger, contact, repository: this.contactsRepository });
    }
  }

  private async handleContactsUpsert(contacts: Contact[]) {
    const logger = this.getLogger("hCttUpsert");
    for (const contact of contacts) {
      await upsertContact({ logger, contact, repository: this.contactsRepository });
    }
  }

  private async handleChatsUpsert(chats: Chat[]) {
    console.log(`[Store] Chats upsert: ${chats.length} chats`);
  }

  private async handleChatsUpdate(updates: Partial<Chat>[]) {
    console.log(`[Store] Chats update: ${updates.length} chats`);
  }

  private async handleGroupsUpdate(groups: Partial<GroupMetadata>[]) {
    console.log(`[Store] Groups update: ${groups.length} groups`);

    for (const group of groups) {
      if (!group.id) continue;

      const existing = await this.rawGroupMetadataRepository.findByRemoteJid(group.id);
      if (!existing) continue;

      const updatedMetadata = { ...existing.groupMetadata, ...group };

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
    const message = await this.messagesRepository.findById(id);

    if (!message) {
      throw new Error(`Message with id ${id} not found`);
    }

    return message;
  }

  public async getMessages(startTime?: Date, endTime?: Date): Promise<RawMessage[]> {
    const messages = await this.messagesRepository.findMany(startTime, endTime);

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
    const messages = await this.messagesRepository.findMany(options.startTime, options.endTime, options.jid);

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
    return await this.rawGroupMetadataRepository.findByRemoteJid(jid);
  }

  public async getGroups(): Promise<RawGroupMetadata[]> {
    return await this.rawGroupMetadataRepository.findMany();
  }

  public async getContacts(): Promise<RawContact[]> {
    return await this.contactsRepository.findMany();
  }

  public async getChats(): Promise<Chat[]> {
    return [];
  }

  public async getContactByLid(_jid: string): Promise<RawContact | null> {
    const possibleIds = _jid.includes("@") ? [_jid] : [_jid, `${_jid}@lid`];

    const contact = await this.contactsRepository.findByPossibleIds(possibleIds);

    if (!contact) {
      return null;
    }

    return this.contactsRepository.mapToRawContact(contact);
  }

  public async getContactByPhone(_phone: string): Promise<RawContact | null> {
    const normalizedPhone = onlyDigits(_phone);
    const contact = await this.contactsRepository.findByPhone(normalizedPhone);

    return contact ? this.contactsRepository.mapToRawContact(contact) : null;
  }

  public async getContactByKey(_key: WAMessageKey): Promise<RawContact | null> {
    const lid = extractLidFromKey(_key);
    const phone = extractPhoneFromKey(_key);

    const phoneContact = phone ? await this.getContactByPhone(phone) : null;
    if (phoneContact) {
      return phoneContact;
    }

    const lidContact = await this.getContactByLid(lid!);
    if (lidContact) {
      return lidContact;
    }

    return null;
  }

  public async getMessageMedia(message: WAMessage): Promise<MessageFile> {
    return await this.mediaService.getMessageMedia(message);
  }
}

export default PrismaBaileysStore;