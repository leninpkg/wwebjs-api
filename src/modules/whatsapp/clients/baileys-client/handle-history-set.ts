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
    normalized = timestamp;
  } else {
    // timestamp é Long
    normalized = timestamp.toNumber();
  }

  return normalized < minTimestamp * 1000;
}

export default handleHistorySet;
