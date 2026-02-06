import { WAMessage, WAMessageKey } from "baileys";
import ProcessingLogger from "../../../../utils/processing-logger";
import BaileysWhatsappClient from "./baileys-whatsapp-client";
import parseMessage from "./parse-message";
import MessageDto from "../../types";
import { isMessageTooOld } from "./handle-history-set";

export interface FetchMessageHistoryOptions {
  /** JID do chat (ex: 5511999999999@s.whatsapp.net) */
  jid: string;
  /** Quantidade de mensagens a buscar */
  count?: number;
  /** ID da mensagem mais antiga conhecida (para paginação) */
  oldestMessageId?: string;
  /** Timestamp da mensagem mais antiga conhecida (para paginação) */
  oldestMessageTimestamp?: number;
  /** Se deve reprocessar as mensagens (emitir eventos) */
  reprocess?: boolean;
}

export interface FetchMessageHistoryResult {
  success: boolean;
  requestId?: string;
  message: string;
}

interface FetchMessageHistoryContext {
  client: BaileysWhatsappClient;
  options: FetchMessageHistoryOptions;
  logger: ProcessingLogger;
}

/**
 * Busca o histórico de mensagens de um chat diretamente do WhatsApp.
 * As mensagens serão recebidas através do evento "messaging-history.set".
 */
async function handleFetchMessageHistory({
  client,
  options,
  logger,
}: FetchMessageHistoryContext): Promise<FetchMessageHistoryResult> {
  const { jid, count = 50, oldestMessageId, oldestMessageTimestamp } = options;

  logger.log("Fetching message history from WhatsApp", {
    jid,
    count,
    oldestMessageId,
    oldestMessageTimestamp,
  });

  // Normalizar o JID
  const normalizedJid = normalizeJid(jid);
  logger.log("Normalized JID", { normalizedJid });

  // Criar a key da mensagem mais antiga para paginação
  const oldestMsgKey: WAMessageKey = {
    remoteJid: normalizedJid,
    id: oldestMessageId || "",
    fromMe: false,
  };

  // Usar timestamp atual se não fornecido
  const timestamp = oldestMessageTimestamp || Math.floor(Date.now() / 1000);

  try {
    // Chama o método do Baileys para buscar histórico
    const requestId = await client._sock.fetchMessageHistory(count, oldestMsgKey, timestamp);

    logger.log("Message history request sent", { requestId });

    logger.success({
      requestId,
      message: "Message history request sent successfully. Messages will arrive via messaging-history.set event.",
    });

    return {
      success: true,
      requestId,
      message: "Solicitação de histórico enviada. As mensagens serão recebidas via evento messaging-history.set.",
    };
  } catch (error: any) {
    logger.failed(error);
    throw new Error(`Falha ao buscar histórico de mensagens: ${error.message}`);
  }
}

/**
 * Solicita o reenvio de uma mensagem placeholder específica.
 * Útil para mensagens que não foram baixadas corretamente.
 */
export async function handleRequestPlaceholderResend(
  client: BaileysWhatsappClient,
  messageKey: WAMessageKey,
  logger: ProcessingLogger,
): Promise<string | undefined> {
  logger.log("Requesting placeholder resend", { messageKey });

  try {
    const result = await client._sock.requestPlaceholderResend(messageKey);
    logger.success({ result });
    return result;
  } catch (error: any) {
    logger.failed(error);
    throw new Error(`Falha ao solicitar reenvio de placeholder: ${error.message}`);
  }
}

/**
 * Reprocessa mensagens do histórico recebido.
 * Emite eventos para cada mensagem como se fossem novas.
 */
export async function reprocessHistoryMessages(
  client: BaileysWhatsappClient,
  messages: WAMessage[],
  logger: ProcessingLogger,
  minTimestamp?: number,
): Promise<MessageDto[]> {
  const processedMessages: MessageDto[] = [];

  logger.log("Reprocessing history messages", { messageCount: messages.length });

  for (const message of messages) {
    try {
      const timestamp = +String(message.messageTimestamp).padEnd(13, "0")

      if (minTimestamp && isMessageTooOld(timestamp, minTimestamp)) {
        logger.log("Skipping message older than minimum timestamp", { messageId: message.key?.id });
        continue;
      }
      // Ignorar mensagens próprias
      if (message.key?.fromMe) {
        logger.log("Skipping own message", { messageId: message.key?.id });
        continue;
      }

      // Ignorar mensagens de broadcast
      if (message.key?.remoteJid?.endsWith("@broadcast")) {
        logger.log("Skipping broadcast message", { messageId: message.key?.id });
        continue;
      }

      // Ignorar mensagens de newsletter
      if (message.key?.remoteJid?.endsWith("@newsletter")) {
        logger.log("Skipping newsletter message", { messageId: message.key?.id });
        continue;
      }

      // Ignorar mensagens de status
      if (message.key?.remoteJid === "status@broadcast") {
        logger.log("Skipping status message", { messageId: message.key?.id });
        continue;
      }

      if (message.message) {
        logger.log("Processing message from history", { messageId: message.key?.id });

        const parsedMessage = await parseMessage({
          message,
          instance: client.instance,
          clientId: client.clientId,
          phone: client.phone,
          logger,
        });

        processedMessages.push(parsedMessage);

        // Emitir evento de mensagem recebida
        client._ev.emit({
          type: "message-received",
          clientId: client.clientId,
          message: parsedMessage,
        });

        logger.log("Emitted message-received event for history message", { messageId: message.key?.id });
      }
    } catch (error: any) {
      logger.log("Error processing history message", { messageId: message.key?.id, error: error.message });
    }
  }

  logger.success({ processedCount: processedMessages.length });
  return processedMessages;
}

function normalizeJid(jid: string): string {
  // Remove sufixos se existirem e adiciona o correto
  const cleanPhone = jid.replace(/@s\.whatsapp\.net|@g\.us|@c\.us/g, "").trim();

  // Se for um grupo (contém hífen), usa @g.us
  if (cleanPhone.includes("-")) {
    return `${cleanPhone}@g.us`;
  }

  // Caso contrário, é um contato individual
  return `${cleanPhone}@s.whatsapp.net`;
}

export default handleFetchMessageHistory;
