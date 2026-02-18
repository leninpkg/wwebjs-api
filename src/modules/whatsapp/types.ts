import { Contact, GroupMetadata, proto } from "baileys";

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
