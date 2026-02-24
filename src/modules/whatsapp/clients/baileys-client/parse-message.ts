import { proto, WAMessage, WAMessageKey } from "baileys";
import ProcessingLogger from "../../../../helpers/processing-logger";
import InpulseMessage from "../../inpulse-types";
import RawMessageFileRepository from "./store/repositories/raw-message-file-repository";
import MediaService from "./store/prisma-baileys-store/services/media-service";

type MessageType = "chat" | "image" | "video" | "audio" | "document" | "sticker" | "contact" | "location" | "call" | "unsupported";

interface ParseMessageParams {
  message: WAMessage;
  instance: string;
  sessionId: string;
  clientId: number;
  phone: string;
  logger: ProcessingLogger;
}

interface BaseMessageContent {
  contactName: string;
  timestamp: string;
  sentAt: Date;
  quotedMessageId?: string | null;
}
interface MessageContent extends BaseMessageContent {
  type: MessageType;
  body: string;
  isFile: boolean;
}

interface FileMessageContent extends MessageContent {
  fileName: string;
  fileType: string;
  fileSize: string;
  isFile: true;
}

async function parseMessage({ message, instance, sessionId, clientId, phone, logger }: ParseMessageParams): Promise<InpulseMessage> {
  logger.log("Parsing message", message);
  const { isFile, contactName, quotedMessageId, ...content } = getMessageContent(message, logger);
  logger.log("Extracted message content", content);

  const isFromMe = message.key.fromMe;
  const from = getMessageFrom(message.key);
  logger.log("Message sender phone", from);

  const isForwarded = getIsForwarded(message);
  logger.log("Is message forwarded", isForwarded);

  const parsedMessage: InpulseMessage = {
    instance,
    clientId,
    wwebjsIdStanza: message.key.id || null,
    from: isFromMe ? `me:${phone}` : from.phone,
    to: isFromMe ? from.phone : `me:${phone}`,
    isForwarded,
    isGroup: from.isGroup,
    groupId: from.groupId || null,
    status: isFromMe ? "PENDING" : "RECEIVED",
    authorName: contactName,
    ...content,
  };
  logger.log("Base parsed message", parsedMessage);

  if (isFile) {
    logger.log("Processing file message", { fileName: (content as FileMessageContent).fileName });
    const mediaService = new MediaService(instance, sessionId, new RawMessageFileRepository());
    const savedMedia = await mediaService.getMessageMedia(message);
    logger.log("Media processed", savedMedia);
    return { ...parsedMessage, fileId: savedMedia.inpulseId ?? null };
  }

  return parsedMessage;
}


function getMessageContent(message: WAMessage, logger: ProcessingLogger, raw?: proto.IMessage): MessageContent | FileMessageContent {
  logger.debug("Getting message content", message);

  raw?.messageContextInfo?.deviceListMetadata?.senderTimestamp
  const timestamp = String(message.messageTimestamp).padEnd(13, "0")
  const sentAt = new Date(Number(timestamp));
  const messageBase: BaseMessageContent = {
    contactName: getMessageContactName(message),
    timestamp,
    quotedMessageId: getMessageQuotedId(message),
    sentAt,
  };

  logger.debug("Message base content", messageBase);

  if (message.message?.extendedTextMessage?.text) {
    logger.debug("Message is extended text message");
    return {
      ...messageBase,
      type: "chat",
      body: message.message.extendedTextMessage.text,
      isFile: false,
    };
  }

  if (message.message?.conversation) {
    logger.debug("Message is conversation text message");
    return {
      ...messageBase,
      type: "chat",
      body: message.message.conversation,
      isFile: false,
    };
  }
  if (message.message?.audioMessage) {
    logger.debug("Message is audio message");
    return {
      ...messageBase,
      body: message.message.conversation || "",
      type: "audio",
      fileName: "audio.ogg",
      fileType: message.message.audioMessage.mimetype || "audio/ogg; codecs=opus",
      fileSize: String(message.message.audioMessage.fileLength || 0),
      isFile: true,
    };
  }
  if (message.message?.imageMessage) {
    logger.debug("Message is image message");
    return {
      ...messageBase,
      body: message.message.imageMessage?.caption || "",
      type: "image",
      fileName: "image.jpg",
      fileType: message.message.imageMessage.mimetype || "image/jpeg",
      fileSize: String(message.message.imageMessage.fileLength || 0),
      isFile: true,
    };
  }
  if (message.message?.videoMessage) {
    logger.debug("Message is video message");
    return {
      ...messageBase,
      body: message.message.videoMessage?.caption || "",
      type: "video",
      fileName: "video.mp4",
      fileType: message.message.videoMessage.mimetype || "video/mp4",
      fileSize: String(message.message.videoMessage.fileLength || 0),
      isFile: true,
    };
  }
  if (message.message?.documentMessage) {
    logger.debug("Message is document message");
    return {
      ...messageBase,
      body: message.message.documentMessage?.caption || "",
      type: "document",
      fileName: message.message.documentMessage?.fileName || "document",
      fileType: message.message.documentMessage.mimetype || "application/octet-stream",
      fileSize: String(message.message.documentMessage.fileLength || 0),
      isFile: true,
    };
  }
  if (message.message?.documentWithCaptionMessage) {
    logger.debug("Message is document with caption message");
    const docMessage = message.message.documentWithCaptionMessage.message?.documentMessage;
    if (docMessage) {
      return {
        ...messageBase,
        body: docMessage.caption || "",
        type: "document",
        fileName: docMessage.fileName || "document",
        fileType: docMessage.mimetype || "application/octet-stream",
        fileSize: String(docMessage.fileLength || 0),
        isFile: true,
      };
    }
  }
  if (message.message?.stickerMessage) {
    logger.debug("Message is sticker message");
    return {
      ...messageBase,
      body: "",
      type: "sticker",
      fileName: "sticker.webp",
      fileType: message.message.stickerMessage.mimetype || "image/webp",
      fileSize: String(message.message.stickerMessage.fileLength || 0),
      isFile: true,
    };
  }

  if (message.message?.contactMessage) {
    logger.debug("Message is contact message");
    const contact = message.message.contactMessage;
    const contactName = contact.displayName || "Contato";
    const contactNumber = contact.vcard?.split("TEL:")[1]?.split("\n")[0] || "Sem número";
    return {
      ...messageBase,
      type: "contact",
      body: `📇 Contato: ${contactName} (${contactNumber})`,
      isFile: false,
    };
  }

  if (message.message?.locationMessage) {
    logger.debug("Message is location message");
    const location = message.message.locationMessage;
    const latitude = location.degreesLatitude;
    const longitude = location.degreesLongitude;
    return {
      ...messageBase,
      type: "location",
      body: `📍 Localização: https://maps.google.com/maps?q=${latitude},${longitude}`,
      isFile: false,
    };
  }

  if (message.message?.bcallMessage) {
    logger.debug("Message is call message");
    return {
      ...messageBase,
      type: "call",
      body: "☎️ Chamada",
      isFile: false,
    };
  }

  if (message.message?.viewOnceMessage) {
    logger.debug("Message is view once message (visualizar uma vez)");
    return {
      ...messageBase,
      type: "unsupported",
      body: "🔐 Mensagem com visualização única - Este tipo de mensagem só pode ser vista uma vez e não pode ser armazenada",
      isFile: false,
    };
  }

  if (message.message?.ephemeralMessage) {
    logger.debug("Message is ephemeral message (mensagem que desaparece)");
    return {
      ...messageBase,
      type: "unsupported",
      body: "⏰ Mensagem temporária - Este tipo de mensagem é configurada para desaparecer e não pode ser armazenada",
      isFile: false,
    };
  }

  if (message.message?.listMessage) {
    logger.debug("Message is list message");
    const listMsg = message.message.listMessage;
    const title = listMsg.title || "Lista";
    const description = listMsg.description || "Selecione uma opção";
    return {
      ...messageBase,
      type: "unsupported",
      body: `📋 ${title}: ${description}\n⚠️ Este tipo de mensagem interativa (lista) deve ser visualizada no aplicativo WhatsApp`,
      isFile: false,
    };
  }

  if (message.message?.buttonsMessage) {
    logger.debug("Message is buttons message");
    const buttonsMsg = message.message.buttonsMessage;
    const buttonTexts = buttonsMsg.buttons?.map((b: any) => `• ${b.buttonText?.displayText || b.buttonId}`).join("\n") || "";
    return {
      ...messageBase,
      type: "unsupported",
      body: `🔘 ${buttonsMsg.contentText}\n${buttonTexts}\n⚠️ Este tipo de mensagem interativa (botões) deve ser visualizada no aplicativo WhatsApp`,
      isFile: false,
    };
  }

  if (message.message?.templateMessage) {
    logger.debug("Message is template message");
    const templateMsg = message.message.templateMessage;
    return {
      ...messageBase,
      type: "unsupported",
      body: `📧 Template: ${templateMsg.hydratedTemplate?.hydratedContentText || "Mensagem de template"}\n⚠️ Este tipo de mensagem de template deve ser visualizada no aplicativo WhatsApp`,
      isFile: false,
    };
  }

  if (message.message?.interactiveMessage) {
    logger.debug("Message is interactive message");
    const interactiveMsg = message.message.interactiveMessage;
    const body = interactiveMsg.body?.text || "Mensagem interativa";
    return {
      ...messageBase,
      type: "unsupported",
      body: `💬 ${body}\n⚠️ Esta mensagem interativa deve ser visualizada no aplicativo WhatsApp`,
      isFile: false,
    };
  }

  if (message.message?.pollUpdateMessage) {
    logger.debug("Message is poll update message");
    return {
      ...messageBase,
      type: "unsupported",
      body: "🗳️ Atualização de enquete - Esta mensagem deve ser visualizada no aplicativo WhatsApp",
      isFile: false,
    };
  }

  if (message.message?.pollCreationMessage) {
    logger.debug("Message is poll creation message");
    const poll = message.message.pollCreationMessage;
    const options = poll.options?.map((opt: any) => `• ${opt.optionName}`).join("\n") || "";
    return {
      ...messageBase,
      type: "unsupported",
      body: `🗳️ Enquete: ${poll.name}\n${options}\n⚠️ Enquetes devem ser respondidas no aplicativo WhatsApp`,
      isFile: false,
    };
  }

  if (message.message?.groupInviteMessage) {
    logger.debug("Message is group invite message");
    const groupInvite = message.message.groupInviteMessage;
    return {
      ...messageBase,
      type: "unsupported",
      body: `👥 Convite para grupo: ${groupInvite.groupName || "Grupo"}\n⚠️ Convites de grupo devem ser aceitos no aplicativo WhatsApp`,
      isFile: false,
    };
  }

  logger.debug("Message type is unsupported");
  return {
    ...messageBase,
    type: "unsupported",
    body: "⚠️ Tipo de mensagem não suportado - Esta mensagem só pode ser visualizada no aplicativo WhatsApp",
    isFile: false,
  };
}

function getMessageContactName(message: WAMessage) {
  return message.verifiedBizName || message.pushName || message.key.remoteJid?.split("@")[0] || "";
}

function getMessageFrom(key: WAMessageKey) {
  const isGroup = key.remoteJid?.includes("@g.us");
  const isLid = key.addressingMode === "lid";

  if (isGroup) {
    const participant = key.participant || "";
    const participantAlt = key.participantAlt || participant;
    const phone = isLid ? participantAlt.split("@")[0] : participant.split("@")[0];

    return {
      phone: phone || key.participant || "",
      isGroup: true,
      groupId: key.remoteJid?.replace("@g.us", "") || "",
    };
  }
  const jid = key.remoteJid || "";
  const jidAlt = key.remoteJidAlt || jid;
  const phone = isLid ? jidAlt.split("@")[0] : jid.split("@")[0];

  return {
    phone: phone || key.remoteJid || "",
    isGroup: false,
  };
}

function getIsForwarded(message: WAMessage): boolean {
  return message.message?.extendedTextMessage?.contextInfo?.isForwarded || false;
}

function getMessageQuotedId(message: WAMessage): string | null {
  return message.message?.extendedTextMessage?.contextInfo?.stanzaId || null;
}

export default parseMessage;
