import { proto } from "baileys";

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

export interface RawGroupMetadata<GroupMetadata> {
  id: string;
  instance: string;
  sessionId: string;
  remoteJid: string;
  groupMetadata: GroupMetadata;
  createdAt?: Date;
  updatedAt?: Date | null;
}
