import "dotenv/config";
import { isJidMetaAI, isJidNewsletter, isJidStatusBroadcast, WAMessage } from "baileys";

interface ShouldIgnoreResult {
  ignore: boolean;
  reason: string;
}

const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const HISTORY_MIN_DATE = process.env["HISTORY_MIN_DATE"] ? new Date(process.env["HISTORY_MIN_DATE"]) : SEVEN_DAYS_AGO;

function isMessageTooOld(message: WAMessage): boolean {
  if (!message.messageTimestamp) return false; // If timestamp is missing, we can't determine age, so we don't ignore based on this criterion
  const msgDate = new Date(+message.messageTimestamp * 1000);

  return HISTORY_MIN_DATE > msgDate;
}

export default function shouldIgnoreMessage(message: WAMessage): ShouldIgnoreResult {
  if (!message.key.id) return { ignore: true, reason: "Missing message ID" };
  if (!message.key.remoteJid) return { ignore: true, reason: "Missing remote JID" };
  if (!message.messageTimestamp) return { ignore: true, reason: "Missing message timestamp" };
  if (!message.message) return { ignore: true, reason: "Missing message content" };

  if (isJidStatusBroadcast(message.key.remoteJid)) return { ignore: true, reason: "Status broadcast" };
  if (isJidMetaAI(message.key.remoteJid)) return { ignore: true, reason: "Meta AI" };
  if (isJidNewsletter(message.key.remoteJid)) return { ignore: true, reason: "Newsletter" };
  if (message.key.fromMe) return { ignore: true, reason: "Message from self" };
  if (message.message?.reactionMessage) return { ignore: true, reason: "Reaction message" };
  if (message.message?.protocolMessage) return { ignore: true, reason: "Protocol message" };
  if (isMessageTooOld(message)) return { ignore: true, reason: "Message too old" };

  return { ignore: false, reason: "" };
}