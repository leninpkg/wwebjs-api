import { MessageUpsertType, WAMessage } from "baileys";
import BaileysWhatsappClient from "./baileys-whatsapp-client";
import ProcessingLogger from "../../../../utils/processing-logger";
import parseMessage from "./parse-message";
import { isMessageTooOld } from "./handle-history-set";
import "dotenv/config";

const IGNORE_GROUP_MESSAGES = process.env["IGNORE_GROUP_MESSAGES"] === "true";

// Data mínima para aceitar mensagens - sincronizado com handle-history-set
const HISTORY_MIN_DATE = getHistoryMinDate();

function getHistoryMinDate(): number {
  if (process.env["HISTORY_MIN_DATE"]) {
    const envDate = process.env["HISTORY_MIN_DATE"];
    const parsedDate = new Date(envDate);
    const timestamp = Math.floor(parsedDate.getTime() / 1000);
    return timestamp;
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const timestamp = Math.floor(sevenDaysAgo.getTime() / 1000);
  return timestamp;
}

interface MessageUpsertContext {
  client: BaileysWhatsappClient;
  logger: ProcessingLogger;
  messages: WAMessage[];
  type: MessageUpsertType;
}

async function handleMessageUpsert({ messages, type, client, logger }: MessageUpsertContext) {
  logger.log(`Received messages upsert of type ${type} | Message count: ${messages.length}`);

  for (const message of messages) {
    if (message.key.fromMe) {
      logger.log("Skipping own message", { messageId: message.key?.id });
      continue;
    }

    const skipOldMsg = message.messageTimestamp && isMessageTooOld(message.messageTimestamp, HISTORY_MIN_DATE)
    const msgDate = message.messageTimestamp ? new Date(+message.messageTimestamp * 1000) : null;
    const initBody = message.message?.conversation || message.message?.extendedTextMessage?.text || "unknown";
    
    console.log(`Recebendo mensagem | De: ${message.key.remoteJid} | Data: ${msgDate?.toDateString()} | Tipo: ${type} | SkippOldMsg: ${skipOldMsg} | Conteúdo: ${initBody}`);

    if (skipOldMsg) {
      logger.log("Skipping old message (outside history window)", {
        messageId: message.key?.id,
        timestamp: message.messageTimestamp,
        minDate: new Date(HISTORY_MIN_DATE * 1000).toISOString()
      });
      continue;
    }

    // Ignorar mensagens de broadcast (terminam com @broadcast)
    if (message.key.remoteJid?.endsWith("@broadcast")) {
      logger.log("Skipping broadcast message", { messageId: message.key?.id });
      continue;
    }

    // Ignorar mensagens de newsletter (terminam com @newsletter)
    if (message.key.remoteJid?.endsWith("@newsletter")) {
      logger.log("Skipping newsletter message", { messageId: message.key?.id });
      continue;
    }

    // Ignorar mensagens de status (status@broadcast)
    if (message.key.remoteJid === "status@broadcast") {
      logger.log("Skipping status message", { messageId: message.key?.id });
      continue;
    }

    // Ignorar mensagens de grupo (terminam com @g.us) se configurado
    if (IGNORE_GROUP_MESSAGES && message.key.remoteJid?.endsWith("@g.us")) {
      logger.log("Skipping group message (disabled by env)", { messageId: message.key?.id });
      continue;
    }

    // Ignorar mensagens de reação
    if (message.message?.reactionMessage) {
      logger.log("Skipping reaction message", { messageId: message.key?.id });
      continue;
    }

    if(message.message?.protocolMessage) {
      logger.log("Skipping protocol message", { messageId: message.key?.id });
      continue;
    }

    if (message.message) {
      // Verificar se a mensagem já existe para evitar processamento duplicado
      if (message.key.id) {
        const exists = await client._storage.messageExists(client.sessionId, message.key.id);
        if (exists) {
          logger.log("Skipping duplicate message (already exists)", { messageId: message.key.id });
          continue;
        }
      }

      logger.log("Saving message to storage", { messageId: message.key?.id });
      await client._storage.saveMessage({
        sessionId: client.sessionId,
        message: message.message,
        key: message.key,
      });

      logger.log("Processing incoming message", { messageId: message.key?.id });

      try {
        const parsedMessage = await parseMessage({
          message,
          instance: client.instance,
          clientId: client.clientId,
          phone: client.phone,
          logger,
          storage: client._storage,
          sessionId: client.sessionId,
        });

        logger.log("Message parsed successfully", { parsedMessage });

        // Update message with parsed data
        await client._storage.updateMessage({
          sessionId: client.sessionId,
          messageId: message.key.id!,
          parsedMessage,
          isParsed: true,
        });

        client._ev.emit({
          type: "message-received",
          clientId: client.clientId,
          message: parsedMessage,
        });

        // Update message as emitted and success
        await client._storage.updateMessage({
          sessionId: client.sessionId,
          messageId: message.key.id!,
          isEmitted: true,
          processingStatus: "success",
        });

        logger.log("Emitted message-received event", { messageId: message.key?.id });
      } catch (error) {
        logger.log("Failed to process message", { messageId: message.key?.id, error });

        // Update message as failed
        await client._storage.updateMessage({
          sessionId: client.sessionId,
          messageId: message.key.id!,
          processingStatus: "failed",
        });
      }
    }
  }

  logger.success({ processedMessages: messages.length, type });
}

export default handleMessageUpsert;
