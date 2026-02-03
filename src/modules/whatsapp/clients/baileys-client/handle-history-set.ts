import type { WAMessage } from "baileys";
import ProcessingLogger from "../../../../utils/processing-logger";
import BaileysWhatsappClient from "./baileys-whatsapp-client";
import { reprocessHistoryMessages } from "./handle-fetch-message-history";
import "dotenv/config";
import { Logger } from "@in.pulse-crm/utils";

// Data mínima para sincronização de histórico
const HISTORY_MIN_DATE = getHistoryMinDate();

function getHistoryMinDate(): number {
  if (process.env["HISTORY_MIN_DATE"]) {
    const envDate = process.env["HISTORY_MIN_DATE"];
    const parsedDate = new Date(envDate);
    const timestamp = Math.floor(parsedDate.getTime() / 1000);
    console.log(`[HISTORY_MIN_DATE] Env value: "${envDate}" → Parsed: ${parsedDate.toISOString()} → Timestamp (seconds): ${timestamp}`);
    return timestamp;
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const timestamp = Math.floor(sevenDaysAgo.getTime() / 1000);
  console.log(`[HISTORY_MIN_DATE] Using default (7 days ago): ${sevenDaysAgo.toISOString()} → Timestamp: ${timestamp}`);
  return timestamp;
}

interface HistorySetContext {
  client: BaileysWhatsappClient;
  messages: WAMessage[];
  isLatest?: boolean;
  logger: ProcessingLogger;
}

interface HistorySetResult {
  savedCount: number;
  skippedCount: number;
  skippedByDateCount: number;
  processedCount: number;
}

/**
 * Processa o evento de histórico de mensagens recebido do WhatsApp.
 */
async function handleHistorySet({
  client,
  messages,
  isLatest,
  logger,
}: HistorySetContext): Promise<HistorySetResult> {
  logger.log("Received messaging history set", { messageCount: messages.length, isLatest });

  const minTimestamp = HISTORY_MIN_DATE;
  const minDate = new Date(minTimestamp * 1000);
  logger.log("Filtering messages", {
    minTimestamp,
    minDateISO: minDate.toISOString(),
    minDateLocal: minDate.toLocaleString(),
    envValue: process.env["HISTORY_MIN_DATE"]
  });

  Logger.debug("[HISTORY] Starting to save new messages from history", {
    minDate: minDate.toLocaleString()
  });

  const { savedCount, skippedCount, skippedByDateCount } = await saveNewMessages({
    client,
    messages,
    minTimestamp,
    logger,
  });

  logger.log("Messages saved", { savedCount, skippedCount, skippedByDateCount });

  const processedMessages = await reprocessHistoryMessages(client, messages, logger);

  await client._storage.updateLastSyncAt(client.sessionId);
  logger.log("Last sync date updated");

  logger.success({
    savedMessages: savedCount,
    skippedMessages: skippedCount,
    skippedByDate: skippedByDateCount,
    processedMessages: processedMessages.length,
  });

  return {
    savedCount,
    skippedCount,
    skippedByDateCount,
    processedCount: processedMessages.length,
  };
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

    if (isMessageTooOld(message, minTimestamp)) {
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

export function isMessageTooOld(message: WAMessage, minTimestamp: number | null): boolean {
  if (!minTimestamp || !message.messageTimestamp) {
    return false;
  }

  let messageTimestamp = typeof message.messageTimestamp === "number"
    ? message.messageTimestamp
    : Number(message.messageTimestamp);

  let normalizedMinTimestamp = minTimestamp;

  // Normalizar timestamps para segundos (10 dígitos)
  // Se timestamp tem 13+ dígitos, está em milissegundos
  const messageTimestampStr = String(Math.floor(messageTimestamp));
  const minTimestampStr = String(Math.floor(normalizedMinTimestamp));

  // Converter para segundos se necessário
  if (messageTimestampStr.length >= 13) {
    messageTimestamp = Math.floor(messageTimestamp / 1000);
    console.log(`[MSG_CHECK] Message timestamp converted from ms to s: ${messageTimestampStr} -> ${messageTimestamp}`);
  }

  if (minTimestampStr.length >= 13) {
    normalizedMinTimestamp = Math.floor(normalizedMinTimestamp / 1000);
    console.log(`[MSG_CHECK] Min timestamp converted from ms to s: ${minTimestampStr} -> ${normalizedMinTimestamp}`);
  }

  // Garantir que ambos tenham o mesmo comprimento agora
  const finalMsgStr = String(Math.floor(messageTimestamp));
  const finalMinStr = String(Math.floor(normalizedMinTimestamp));

  if (finalMsgStr.length !== finalMinStr.length) {
    console.warn(`[MSG_CHECK] WARNING: Timestamp lengths still differ after normalization! Msg: ${finalMsgStr.length} digits, Min: ${finalMinStr.length} digits`);
  }

  const msgDate = new Date(messageTimestamp * 1000);
  const minDate = new Date(normalizedMinTimestamp * 1000);
  const isTooOld = messageTimestamp < normalizedMinTimestamp;

  console.log(`[MSG_CHECK] ID: ${message.key.id?.substring(0, 15)}... | Msg: ${msgDate.toISOString()} (${messageTimestamp}, ${finalMsgStr.length}d) | Min: ${minDate.toISOString()} (${normalizedMinTimestamp}, ${finalMinStr.length}d) | Too old? ${isTooOld}`);

  return isTooOld;
}

export default handleHistorySet;
