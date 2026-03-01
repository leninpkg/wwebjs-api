import { BaileysEventEmitter, BaileysEventMap, Chat, Contact, GroupMetadata, proto, WAMessage, WAMessageKey } from "baileys";
import { EventEmitter } from "events";
import onlyDigits from "../../../../../../helpers/only-digits";
import { extractLidFromKey } from "../../helpers/extract-lid-from-key";
import { extractPhoneFromKey } from "../../helpers/extract-phone-from-key";
import { PrismaLogger } from "../../logger/prisma-logger";
import { MessageUpdateEvent, MessageUpsertEvent, RawContact, RawGroup, RawMessage } from "../../types";
import BaileysStore, { GetMessageMediaResult, GetMessagesByChatOptions } from "../baileys-store";
import MessageProcessingQueue from "../../../../../message-processing-queue";
import { type MessageProcessingQueueOptions } from "../../../../../message-processing-queue";
import ContactsRepository from "./contacts/contacts-repository";
import updateContact from "./contacts/update-contact";
import upsertContact from "./contacts/upsert-contact";
import getMessageMedia from "./messages/get-message-media";
import MessagesRepository from "./messages/messages-repository";
import updateMessage from "./messages/update-message";
import upsertMessage from "./messages/upsert-message";
import GroupsRepository from "./groups/groups-repository";
import updateGroup from "./groups/update-group";
import updateLidMapping from "./contacts/update-lid-mapping";

export interface MessageUpsertStoreEvent {
  messageId: string;
  sessionId: string;
  instance: string;
  message: WAMessage;
}

export interface MessageUpdateStoreEvent {
  messageId: string;
  sessionId: string;
  instance: string;
  update: MessageUpdateEvent[number];
}

type StoreEventMap = {
  "message-upsert": MessageUpsertStoreEvent;
  "message-update": MessageUpdateStoreEvent;
};

type StoreEventName = keyof StoreEventMap;
type StoreEventListener<T extends StoreEventName> = (payload: StoreEventMap[T]) => void;

class PrismaBaileysStore implements BaileysStore {
  private readonly messagesRepo: MessagesRepository;
  private readonly messageQueue: MessageProcessingQueue;
  private readonly contactsRepo: ContactsRepository;
  private readonly groupsRepo: GroupsRepository;
  private readonly emitterName = "WppStore";
  private readonly storeEvents = new EventEmitter();

  constructor(
    private readonly instance: string,
    private readonly sessionId: string,
    private readonly logger: PrismaLogger,
    queueOptions?: MessageProcessingQueueOptions
  ) {
    this.messagesRepo = new MessagesRepository(this.sessionId, this.instance);
    
    // Se não fornecer opções de queue, usa padrão mínimo com handlers stub
    this.messageQueue = new MessageProcessingQueue(
      queueOptions || {
        sessionId: this.sessionId,
        logger: {
          error: (error: unknown, msg: string, emitter?: string, op?: string) => this.logger.error(error, msg, emitter, op),
          warn: (error: unknown, msg: string, emitter?: string, op?: string) => this.logger.warn(error, msg, emitter, op),
          info: (msg: string, emitter?: string, op?: string) => this.logger.info(msg, emitter, op),
        },
        backoffStrategy: {
          getNextAttemptAt: (attempt: number) => {
            const delays = [1000, 5000, 15000, 30000, 60000];
            const index = Math.min(Math.max(attempt - 1, 0), delays.length - 1);
            return new Date(Date.now() + delays[index]!);
          },
        },
        processReceive: async (messageId: string) => {
          const message = await this.messagesRepo.findById(messageId);
          if (!message) {
            throw new Error(`Message ${messageId} not found for RECEIVE processing`);
          }
        },
        processEdit: async (messageId: string) => {
          const message = await this.messagesRepo.findById(messageId);
          if (!message) {
            throw new Error(`Message ${messageId} not found for EDIT processing`);
          }
        },
      }
    );
    this.contactsRepo = new ContactsRepository(this.sessionId, this.instance);
    this.groupsRepo = new GroupsRepository(this.sessionId, this.instance);
  }

  private getLogger(operationName: string) {
    const now = Date.now();
    const id = `${this.sessionId}:${operationName}:${now}`;
    return this.logger.getCorrelatedLogger(this.emitterName, operationName, id);
  }

  public bind(ev: BaileysEventEmitter): void {
    this.messageQueue.start();

    ev.on("messaging-history.set", this.handleHistorySet.bind(this));
    ev.on("contacts.upsert", this.handleContactsUpsert.bind(this));
    ev.on("contacts.update", this.handleContactsUpdate.bind(this));
    ev.on("messages.upsert", this.handleMessagesUpsert.bind(this));
    ev.on("messages.update", this.handleMessagesUpdate.bind(this));
    ev.on("groups.upsert", this.handleGroupsUpsert.bind(this));
    ev.on("groups.update", this.handleGroupsUpdate.bind(this));
    ev.on("lid-mapping.update", this.handleLidMappingUpdate.bind(this));
  }

  public on<T extends StoreEventName>(event: T, listener: StoreEventListener<T>): void {
    this.storeEvents.on(event, listener as (...args: unknown[]) => void);
  }

  public off<T extends StoreEventName>(event: T, listener: StoreEventListener<T>): void {
    this.storeEvents.off(event, listener as (...args: unknown[]) => void);
  }

  private async handleMessagesUpsert({ messages }: MessageUpsertEvent, logger = this.getLogger("hMsgUpsert")) {
    for (const message of messages) {
      const wasUpserted = await upsertMessage({ instance: this.instance, logger, message, repository: this.messagesRepo });

      if (!wasUpserted || !message.key.id) {
        continue;
      }

      await this.messageQueue.enqueueReceive(message.key.id);

      this.storeEvents.emit("message-upsert", {
        messageId: message.key.id,
        sessionId: this.sessionId,
        instance: this.instance,
        message,
      } satisfies MessageUpsertStoreEvent);
    }
  }

  private async handleMessagesUpdate(updates: MessageUpdateEvent) {
    const logger = this.getLogger("hMsgUpdate");
    for (const update of updates) {
      const wasUpdated = await updateMessage({ logger, update, repository: this.messagesRepo });

      if (!wasUpdated || !update.key.id) {
        continue;
      }

      await this.messageQueue.enqueueEdit(update.key.id);

      this.storeEvents.emit("message-update", {
        messageId: update.key.id,
        sessionId: this.sessionId,
        instance: this.instance,
        update,
      } satisfies MessageUpdateStoreEvent);
    }
  }

  private async handleHistorySet(data: BaileysEventMap["messaging-history.set"], logger = this.getLogger("hHistorySet")) {
    logger.info(`Processing history set: ${data.messages.length} messages, ${data.contacts.length} contacts, ${data.chats.length} chats`);
    await this.handleMessagesUpsert({ messages: data.messages, type: "notify" }, logger);
    await this.handleContactsUpsert(data.contacts, logger);
    logger.info(`Finished processing history set`);
  }

  private async handleContactsUpsert(contacts: Contact[], logger = this.getLogger("hCttUpsert")) {
    logger.info(`Upserting ${contacts.length} contacts`);
    for (const contact of contacts) {
      await upsertContact({ logger, contact, contactsRepo: this.contactsRepo, groupsRepo: this.groupsRepo });
    }
  }

  private async handleContactsUpdate(contacts: Partial<Contact>[], logger = this.getLogger("hCttUpdate")) {
    logger.info(`Updating ${contacts.length} contacts`);
    for (const contact of contacts) {
      await updateContact({ logger, contact, repository: this.contactsRepo });
    }
  }

  private async handleGroupsUpsert(groups: GroupMetadata[], logger = this.getLogger("hGroupsUpsert")) {
    logger.info(`Upserting ${groups.length} groups`);
    for (const group of groups) {
      await this.groupsRepo.upsert(group.id, group);
    }
  }

  private async handleGroupsUpdate(groups: Partial<GroupMetadata>[], logger = this.getLogger("hGroupsUpdate")) {
    logger.info(`Updating ${groups.length} groups`);
    for (const group of groups) {
      await updateGroup({ logger, group, repository: this.groupsRepo });
    }
  }

  private async handleLidMappingUpdate({ lid, pn }: { lid: string, pn: string }) {
    await updateLidMapping({ lid, pn, repository: this.contactsRepo });
  }

  public async getMessage(id: string): Promise<RawMessage> {
    const message = await this.messagesRepo.findById(id);

    if (!message) {
      throw new Error(`Message with id ${id} not found`);
    }

    return message;
  }

  public async getMessages(startTime?: Date, endTime?: Date): Promise<RawMessage[]> {
    const messages = await this.messagesRepo.findMany(startTime, endTime);

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
    const messages = await this.messagesRepo.findMany(options.startTime, options.endTime, options.jid);

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

  public async getGroup(jid: string): Promise<RawGroup | null> {
    return await this.groupsRepo.findById(jid);
  }

  public async getGroups(): Promise<RawGroup[]> {
    return await this.groupsRepo.findMany();
  }

  public async getContacts(): Promise<RawContact[]> {
    return await this.contactsRepo.findMany();
  }

  public async getChats(): Promise<Chat[]> {
    return [];
  }

  public async getContactByLid(lid: string): Promise<RawContact | null> {
    const normalizedLid = lid.split("@")[0];
    if (!normalizedLid) return null;

    const contact = await this.contactsRepo.findByLid(normalizedLid);
    if (!contact) return null;

    return this.contactsRepo.mapToRawContact(contact);
  }

  public async getContactByPhone(_phone: string): Promise<RawContact | null> {
    const normalizedPhone = onlyDigits(_phone);
    const contact = await this.contactsRepo.findByPhone(normalizedPhone);

    return contact ? this.contactsRepo.mapToRawContact(contact) : null;
  }

  public async getContactByKey(_key: WAMessageKey): Promise<RawContact | null> {
    const lid = extractLidFromKey(_key);
    const phone = extractPhoneFromKey(_key);

    const phoneContact = phone ? await this.getContactByPhone(phone) : null;
    if (phoneContact) {
      return phoneContact;
    }

    const lidContact = lid ? await this.getContactByLid(lid) : null;
    if (lidContact) {
      return lidContact;
    }

    return null;
  }

  public async getMessageMedia(message: WAMessage, logger = this.getLogger("getMessageMedia")): Promise<GetMessageMediaResult> {
    return await getMessageMedia({ message, logger, repository: this.messagesRepo, instance: this.instance });
  }
}

export default PrismaBaileysStore;