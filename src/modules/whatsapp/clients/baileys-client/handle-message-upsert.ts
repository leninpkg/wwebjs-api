import { MessageUpsertType, WAMessage } from "baileys";
import BaileysWhatsappClient from "./baileys-whatsapp-client";
import ProcessingLogger from "../../../../helpers/processing-logger";
import parseMessage from "./parse-message";
import "dotenv/config";

const IGNORE_GROUP_MESSAGES = process.env["IGNORE_GROUP_MESSAGES"] === "true";

interface MessageUpsertContext {
  client: BaileysWhatsappClient;
  logger: ProcessingLogger;
  messages: WAMessage[];
  type: MessageUpsertType;
}

async function handleMessageUpsert({ messages, type, client, logger }: MessageUpsertContext) {
  logger.log(`Received messages upsert of type ${type}`, { messageCount: messages.length });

  for (const message of messages) {
    if (message.key.fromMe) {
      logger.log("Skipping own message", { messageId: message.key?.id });
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

    if (message.message) {
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
          sessionId: client.sessionId,
          clientId: client.clientId,
          phone: client.phone,
          logger,
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
