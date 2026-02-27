import { isJidMetaAI, isJidNewsletter, isJidStatusBroadcast, WAMessage } from "baileys";

interface ShouldIgnoreResult {
  ignore: boolean;
  reason: string;
}

export default function shouldIgnoreMessage(message: WAMessage): ShouldIgnoreResult {
  if (!message.key.id) return { ignore: true, reason: "Missing message ID" };
  if (!message.key.remoteJid) return { ignore: true, reason: "Missing remote JID" };
  if (!message.messageTimestamp) return { ignore: true, reason: "Missing message timestamp" };

  if (isJidStatusBroadcast(message.key.remoteJid)) return { ignore: true, reason: "Status broadcast" };
  if (isJidMetaAI(message.key.remoteJid)) return { ignore: true, reason: "Meta AI" };
  if (isJidNewsletter(message.key.remoteJid)) return { ignore: true, reason: "Newsletter" };
  if (message.key.fromMe) return { ignore: true, reason: "Message from self" };
  if (message.message?.reactionMessage) return { ignore: true, reason: "Reaction message" };
  if (message.message?.protocolMessage) return { ignore: true, reason: "Protocol message" };

  return { ignore: false, reason: "" };
}