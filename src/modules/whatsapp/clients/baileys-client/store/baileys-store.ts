import { BaileysEventEmitter, Chat, Contact, GroupMetadata, WAMessageKey } from "baileys";
import { RawMessage } from "../../../../../generated/prisma/client";

export interface GetMessagesOptions {
  startTime?: Date;
  endTime?: Date;
}

export interface GetMessagesByChatOptions extends GetMessagesOptions {
  jid: string;
}

abstract class BaileysStore {
  abstract bind(ev: BaileysEventEmitter): void;
  abstract getMessage(id: string): Promise<RawMessage>;
  abstract getMessages(startTime?: Date, endTime?: Date): Promise<RawMessage[]>;
  abstract getMessagesByChat(options: GetMessagesByChatOptions): Promise<RawMessage[]>;
  abstract getGroups(): Promise<GroupMetadata[]>;
  abstract getContacts(): Promise<Contact[]>;
  abstract getChats(): Promise<Chat[]>;
  abstract getContactByJid(jid: string): Promise<Contact | null>;
  abstract getContactByPhone(phone: string): Promise<Contact | null>;
  abstract getContactByKey(key: WAMessageKey): Promise<Contact | null>;
}

export default BaileysStore;