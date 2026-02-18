import InpulseMessage from "../whatsapp/inpulse-types";

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

export interface MessageReceivedEvent {
  type: "message-received";
  clientId: number;
  message: InpulseMessage;
}

export interface MessageStatusReceivedEvent {
  type: "message-status-received";
  clientId: number;
  messageId: string;
  status: string;
  timestamp: number;
}

export type WppEvent = QRReceivedEvent | AuthSuccessEvent | MessageReceivedEvent | MessageStatusReceivedEvent;
