import { BaileysEventMap, proto, Contact, GroupMetadata } from "baileys";

export type ProcessingStatus = "processing" | "success" | "failed";

export interface MessageJson {
  id: number;
  session_id: string;
  remote_jid: string;
  message_id: string;
  from_me: boolean;
  message_data: string; // JSON stringified proto.IMessage
  key_data: string; // JSON stringified proto.IMessageKey
  processing_status: ProcessingStatus;
  parsed_message: string | null; // JSON stringified parsed message
  is_parsed: boolean;
  is_emitted: boolean;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

export interface Message {
  id: number;
  session_id: string;
  remote_jid: string;
  message_id: string;
  from_me: boolean;
  message_data: proto.IMessage;
  key_data: proto.IMessageKey;
  processing_status: ProcessingStatus;
  parsed_message: any | null;
  is_parsed: boolean;
  is_emitted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MessageFile {
  messageId: string;
  inpulseId: number | null;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  filePath: string;
}

// Backwards compatibility aliases
/** @deprecated Use FullMessageJson instead */
export type FullRawMessageJson = MessageJson;
/** @deprecated Use FullMessage instead */
export type FullRawMessage = Message;


export type MessageUpsertEvent = BaileysEventMap["messages.upsert"];
export type MessageUpdateEvent = BaileysEventMap["messages.update"];
export type MessageDeleteEvent = BaileysEventMap["messages.delete"];
export interface RawMessage {
  id: string;
  instance: string;
  sessionId: string;
  remoteJid: string;
  timestamp: string;
  keyData: proto.IMessageKey
  messageData: proto.IMessage;
  createdAt?: Date;
  updatedAt?: Date | null;
}

export interface RawGroupMetadata {
  id: string;
  instance: string;
  sessionId: string;
  remoteJid: string;
  groupMetadata: GroupMetadata;
  createdAt?: Date;
  updatedAt?: Date | null;
}

export interface RawContact {
  id: string;
  instance: string;
  sessionId: string;
  phone: string | null;
  name: string | null;
  verifiedName: string | null;
  avatarUrl: string | null;
  rawData: Contact;
}
