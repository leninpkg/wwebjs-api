import { type File } from "@in.pulse-crm/sdk";

type TemplateSource = "waba" | "gupshup";

export interface TemplateMessage {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  text: string;
  source: TemplateSource;
  raw: any;
}

export type MessageStatus = "PENDING" | "SENT" | "RECEIVED" | "READ" | "DOWNLOADED" | "ERROR" | "REVOKED";

export default interface MessageDto {
  instance: string;
  from: string;
  to: string;
  body: string;
  type: string;
  timestamp: string;
  sentAt: Date;
  status: MessageStatus;
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
  clientId: number | null;
}

interface BaseSendMessageOptions {
  to: string;
  quotedId?: string | null;
  mentions?: Mentions;
}

export type SendFileType = "image" | "video" | "audio" | "document";

export interface SendFileOptions extends BaseSendMessageOptions {
  text?: string | null;
  sendAsAudio?: boolean;
  sendAsDocument?: boolean;
  fileUrl: string;
  fileName: string;
  fileType?: SendFileType;
  file: File;
}

export interface SendTextOptions extends BaseSendMessageOptions {
  text: string;
}

export type SendMessageOptions = SendTextOptions | SendFileOptions;

export interface EditMessageOptions {
  messageId: string;
  text: string;
  mentions?: Mentions | null;
}

export interface TemplateVariables {
  saudação_tempo: string;
  cliente_cnpj: string;
  cliente_razao: string;
  contato_primeiro_nome: string;
  contato_nome_completo: string;
  atendente_nome: string;
  atendente_nome_exibição: string;
}

export interface SendTemplateOptions extends BaseSendMessageOptions {
  template: TemplateMessage;
  templateVariables: TemplateVariables;
  components: string[];
}

export interface WhatsappInstanceProps {
  phone: string;
  instanceName: string;
}
export type Mention = {
  userId: number;
  name: string;
  phone: string;
};

export type Mentions = Mention[];

export interface FetchMessageHistoryOptions {
  /** JID do chat (ex: 5511999999999@s.whatsapp.net ou apenas o número) */
  jid: string;
  /** Quantidade de mensagens a buscar (padrão: 50) */
  count?: number;
  /** ID da mensagem mais antiga conhecida (para paginação) */
  oldestMessageId?: string;
  /** Timestamp da mensagem mais antiga conhecida (para paginação) */
  oldestMessageTimestamp?: number;
  /** Se deve reprocessar as mensagens emitindo eventos (padrão: false) */
  reprocess?: boolean;
}

export interface FetchMessageHistoryResult {
  success: boolean;
  requestId?: string;
  message: string;
}

export type WhatsAppMention = { id: string; tag?: string };

export interface WhatsappTemplate {}
