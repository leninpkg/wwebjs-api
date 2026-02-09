import MessageDto from "../whatsapp/types";

export interface QRReceivedEvent {
  type: "qr-received";
  clientId: number;
  qr: string;
}

export interface AuthSuccessEvent {
  type: "auth-success";
  clientId: number;
  phoneNumber: string;
}

export interface AuthLogoutEvent {
  type: "auth-logout";
  clientId: number;
  reason?: string;
}

export interface MessageReceivedEvent {
  type: "message-received";
  clientId: number;
  message: MessageDto;
}

export interface MessageStatusReceivedEvent {
  type: "message-status-received";
  clientId: number;
  messageId: string;
  status: string;
  timestamp: number;
}

export type WppEvent = QRReceivedEvent | AuthSuccessEvent | AuthLogoutEvent | MessageReceivedEvent | MessageStatusReceivedEvent;
