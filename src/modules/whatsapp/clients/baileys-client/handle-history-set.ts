import type { WAMessage } from "baileys";
import ProcessingLogger from "../../../../utils/processing-logger";
import BaileysWhatsappClient from "./baileys-whatsapp-client";
import { reprocessHistoryMessages } from "./handle-fetch-message-history";

// Data mínima para sincronização de histórico
const HISTORY_MIN_DATE = getHistoryMinDate();

function getHistoryMinDate(): number {
  if (process.env["HISTORY_MIN_DATE"]) {
    return new Date(process.env["HISTORY_MIN_DATE"]).getTime() / 1000;
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return sevenDaysAgo.getTime() / 1000;
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

  const lastSyncAt = await client._storage.getLastSyncAt(client.sessionId);
  logger.log("Last sync date retrieved", { lastSyncAt });

  const minTimestamp = calculateMinTimestamp(lastSyncAt);
  logger.log("Filtering messages", { minTimestamp, HISTORY_MIN_DATE, lastSyncAt });

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

function calculateMinTimestamp(lastSyncAt: Date | null): number | null {
  const lastSyncAtTimestamp = lastSyncAt ? lastSyncAt.getTime() / 1000 : null;
  return Math.max(HISTORY_MIN_DATE || 0, lastSyncAtTimestamp || 0) || null;
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

function isMessageTooOld(message: WAMessage, minTimestamp: number | null): boolean {
  if (!minTimestamp || !message.messageTimestamp) {
    return false;
  }

  const messageTimestamp = typeof message.messageTimestamp === "number"
    ? message.messageTimestamp
    : Number(message.messageTimestamp);

  return messageTimestamp < minTimestamp;
}

export default handleHistorySet;
