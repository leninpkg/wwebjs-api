import { proto } from "baileys";

export default function extractQuotedMessage(message: proto.IMessage): proto.IMessage | null {
  if (message?.extendedTextMessage?.contextInfo?.quotedMessage) {
    return message.extendedTextMessage.contextInfo.quotedMessage;
  }
  if (message?.imageMessage?.contextInfo?.quotedMessage) {
    return message.imageMessage.contextInfo.quotedMessage;
  }
  if (message?.videoMessage?.contextInfo?.quotedMessage) {
    return message.videoMessage.contextInfo.quotedMessage;
  }
  if (message?.audioMessage?.contextInfo?.quotedMessage) {
    return message.audioMessage.contextInfo.quotedMessage;
  }
  if (message?.documentMessage?.contextInfo?.quotedMessage) {
    return message.documentMessage.contextInfo.quotedMessage;
  }
  return null;
}