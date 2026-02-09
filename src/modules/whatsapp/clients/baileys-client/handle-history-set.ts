import type { WAMessage } from "baileys";
import "dotenv/config";
import ProcessingLogger from "../../../../utils/processing-logger";
import BaileysWhatsappClient from "./baileys-whatsapp-client";
import handleMessageUpsert from "./handle-message-upsert";

interface HistorySetContext {
  client: BaileysWhatsappClient;
  messages: WAMessage[];
  isLatest?: boolean;
  logger: ProcessingLogger;
}

/**
 * Processa o evento de histórico de mensagens recebido do WhatsApp.
 */
async function handleHistorySet({
  client,
  messages,
  isLatest,
  logger,
}: HistorySetContext) {
  logger.log("Received messaging history set", { messageCount: messages.length, isLatest });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const envMinDate = process.env["HISTORY_MIN_DATE"];
  const minDate = envMinDate ? new Date(envMinDate) : sevenDaysAgo;

  logger.log(`Filtering messages with min date: ${minDate.toISOString()} (timestamp: ${minDate.getTime()})`);

  await handleMessageUpsert({
    messages,
    type: "append",
    client,
    logger
  });

  logger.success(`Finished processing history set. Total messages: ${messages.length}`);

}

interface SaveMessagesContext {
  client: BaileysWhatsappClient;
  messages: WAMessage[];
  minTimestamp: number | null;
  logger: ProcessingLogger;
}

interface SaveMessagesResult {
  savedCount: number;
  skippedCount: number;
  skippedByDateCount: number;
}

async function saveNewMessages({
  client,
  messages,
  minTimestamp,
  logger,
}: SaveMessagesContext): Promise<SaveMessagesResult> {
  let savedCount = 0;
  let skippedCount = 0;
  let skippedByDateCount = 0;

  for (const message of messages) {
    if (!message.message || !message.key.id) {
      continue;
    }

    if (!message.messageTimestamp || isMessageTooOld(message.messageTimestamp, minTimestamp)) {
      skippedByDateCount++;
      continue;
    }

    const exists = await client._storage.messageExists(client.sessionId, message.key.id);
    if (exists) {
      skippedCount++;
      continue;
    }

    logger.log("Saving message from history", { messageId: message.key.id });
    await client._storage.saveMessage({
      sessionId: client.sessionId,
      message: message.message,
      key: message.key,
    });
    savedCount++;
  }

  return { savedCount, skippedCount, skippedByDateCount };
}

export function isMessageTooOld(timestamp: number | string | Long, minTimestamp: number | null): boolean {
  if (!minTimestamp || !timestamp) {
    return false;
  }

  let normalized: number;

  if (typeof timestamp === "string") {
    normalized = parseInt(timestamp.padEnd(13, "0"));
  } else if (typeof timestamp === "number") {
    // Baileys envia timestamps em segundos (10 dígitos) — normalizar para milissegundos
    normalized = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  } else {
    // timestamp é Long — também em segundos
    const num = timestamp.toNumber();
    normalized = num < 1e12 ? num * 1000 : num;
  }

  // minTimestamp está em segundos, converter para milissegundos para comparar
  return normalized < minTimestamp * 1000;
}

export default handleHistorySet;
