import { isJidMetaAI, isJidNewsletter, isJidStatusBroadcast, WAMessage } from "baileys";

export default function shouldIgnoreMessage(message: WAMessage): boolean {
  if (!message.key.id) return true;
  if (!message.key.remoteJid) return true;
  if (!message.messageTimestamp) return true;

  if (isJidStatusBroadcast(message.key.remoteJid)) return true;
  if (isJidMetaAI(message.key.remoteJid)) return true;
  if (isJidNewsletter(message.key.remoteJid)) return true;
  if (message.key.fromMe) return true;
  if (message.message?.reactionMessage) return true;
  if (message.message?.protocolMessage) return true;

  return false;
}