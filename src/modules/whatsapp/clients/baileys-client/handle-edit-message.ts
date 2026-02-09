import { jidNormalizedUser } from "baileys";
import { EditMessageOptions } from "../../types";
import BaileysWhatsappClient from "./baileys-whatsapp-client";
import ProcessingLogger from "../../../../utils/processing-logger";
import parseMessage from "./parse-message";

interface EditMessageContext {
  client: BaileysWhatsappClient;
  options: EditMessageOptions;
  logger: ProcessingLogger;
}

/**
 * Normalize phone number to JID format
 * Converts "5511999999999" to "5511999999999@s.whatsapp.net"
 */
function normalizeToJid(to: string): string {
  // Remove any existing suffix
  const cleanPhone = to.replace(/@(s\.whatsapp\.net|c\.us)$/, "").trim();

  // Validate it's a valid phone number
  if (!cleanPhone || !/^\d+$/.test(cleanPhone)) {
    throw new Error(`Invalid phone number format: ${to}`);
  }

  // For mentions, always use @s.whatsapp.net (individual contacts)
  return `${cleanPhone}@s.whatsapp.net`;
}

async function handleEditMessage({ client, options, logger }: EditMessageContext) {
  logger.log(`Handling edit message for message ID ${options.messageId}`);
  const message = await client._storage.getFullRawMessage(client.sessionId, options.messageId);

  if (!message) {
    throw new Error(`Message with ID ${options.messageId} not found`);
  }

  const isGroup = message.remote_jid.endsWith("@g.us");
  logger.log(`Preparing mentions for message ID ${options.messageId} (isGroup: ${isGroup})`);
  const mentions: string[] = [];

  options.mentions?.forEach((mention) => {
    const normalizedJid = normalizeToJid(mention.phone);
    const jid = jidNormalizedUser(normalizedJid);
    if (jid) {
      mentions.push(jid);
    }
  });
  logger.log(`Prepared ${mentions.length} mentions`, mentions);
  logger.log(`Sending edited message for message ID ${options.messageId}`);

  const editedMsg = await client._sock.sendMessage(message.remote_jid, {
    text: options.text,
    mentions,
    edit: {
      id: options.messageId,
    },
  });

  if (!editedMsg) {
    throw new Error(`Failed to edit message with ID ${options.messageId}`);
  }
  logger.success(`Edited message with ID ${options.messageId} successfully`);
  logger.log(`Parsing edited message for message ID ${options.messageId}`);
  const parsedMessage = parseMessage({
    message: editedMsg,
    instance: client.instance,
    clientId: client.clientId,
    phone: client.phone,
    logger,
    storage: client._storage,
    sessionId: client.sessionId,
  });
  logger.success(`Parsed edited message for message ID ${options.messageId} successfully`);
  return parsedMessage;
}

export default handleEditMessage;
