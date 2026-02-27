import { BaileysEventEmitter, Chat, WAMessage, WAMessageKey } from "baileys";
import { MessageMedia, RawContact, RawGroupMetadata, RawMessage } from "../types";

export interface GetMessagesOptions {
  startTime?: Date;
  endTime?: Date;
}

export interface GetMessagesByChatOptions extends GetMessagesOptions {
  jid: string;
}

export type GetMessageMediaResult = {
  success: false;
  reason: string;
  media: null;
} | {
  success: true;
  media: MessageMedia;
}

abstract class BaileysStore {
  abstract bind(ev: BaileysEventEmitter): void;
  abstract getMessage(id: string): Promise<RawMessage | null>;
  abstract getMessages(startTime?: Date, endTime?: Date): Promise<RawMessage[]>;
  abstract getMessagesByChat(options: GetMessagesByChatOptions): Promise<RawMessage[]>;
  abstract getGroup(jid: string): Promise<RawGroupMetadata | null>;
  abstract getGroups(): Promise<RawGroupMetadata[]>;
  abstract getContacts(): Promise<RawContact[]>;
  abstract getChats(): Promise<Chat[]>;
  abstract getContactByLid(jid: string): Promise<RawContact | null>;
  abstract getContactByPhone(phone: string): Promise<RawContact | null>;
  abstract getContactByKey(key: WAMessageKey): Promise<RawContact | null>;
  abstract getMessageMedia(message: WAMessage): Promise<GetMessageMediaResult>;
}

export default BaileysStore;