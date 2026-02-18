import { type File } from "@in.pulse-crm/sdk";

export type InpulseMessageStatus = "PENDING" | "SENT" | "RECEIVED" | "READ" | "DOWNLOADED" | "ERROR" | "REVOKED";
export default interface InpulseMessage {
  instance: string;
  from: string;
  to: string;
  body: string;
  type: string;
  timestamp: string;
  sentAt: Date;
  status: InpulseMessageStatus;
  quotedId?: null | number;
  chatId?: null | number;
  contactId?: null | number;
  userId?: number;
  wwebjsId?: null | string;
  wwebjsIdStanza?: null | string;
  gupshupId?: null | string;
  wabaId?: null | string;
  fileId?: null | number;
  fileName?: null | string;
  fileType?: null | string;
  fileSize?: null | string;
  isForwarded?: false | boolean;
  isGroup: boolean;
  authorName?: null | string;
  groupId?: null | string;
  clientId: number | null;
}

interface CoreSendMessageRequest {
  to: string;
  quotedId?: string | null;
  mentions?: InpulseMessageMention[] | null;
  isGroup?: boolean;
}

export type SendFileType = "image" | "video" | "audio" | "document";

export interface SendFileMessageRequest extends CoreSendMessageRequest {
  text?: string | null;
  sendAsAudio?: boolean;
  sendAsDocument?: boolean;
  fileUrl: string;
  fileName: string;
  fileType?: SendFileType;
  file: File;
}

export interface SendTextMessageRequest extends CoreSendMessageRequest {
  text: string;
}

export type SendMessageRequest = SendTextMessageRequest | SendFileMessageRequest;

export interface EditMessageRequest {
  messageId: string;
  text: string;
  mentions?: InpulseMessageMention[] | null;
}

export type InpulseMessageMention = {
  userId: number;
  name: string;
  phone: string;
};
