import { FileDirType } from "@in.pulse-crm/sdk";
import { downloadMediaMessage, WAMessage, WAMessageKey } from "baileys";
import ProcessingLogger from "../../../../utils/processing-logger";
import type DataClient from "../../../data/data-client";
import filesService from "../../../files/files.service";
import MessageDto from "../../types";

type MessageType = "chat" | "image" | "video" | "audio" | "document" | "sticker" | "contact" | "location" | "call" | "unsupported";

interface ParseMessageParams {
  message: WAMessage;
  instance: string;
  clientId: number;
  phone: string;
  logger: ProcessingLogger;
  storage: DataClient;
  sessionId: string;
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

async function parseMessage({ message, instance, clientId, phone, logger, storage, sessionId }: ParseMessageParams): Promise<MessageDto> {
  logger.log("Parsing message");
  const { isFile, contactName, quotedMessageId, ...content } = getMessageContent(message, logger);

  const isFromMe = message.key.fromMe;

  logger.log("Verifying message sender info");
  const from = await resolveMessageFrom(message.key, storage, sessionId, logger);
  logger.log("Message sender phone", from);

  // Se a mensagem veio de um LID e conseguimos resolver o telefone, salvar o mapeamento para futuras consultas
  const isLid = message.key.addressingMode === "lid" || message.key.remoteJid?.endsWith("@lid");
  if (isLid && from.phone) {
    const lidId = message.key.remoteJid?.split("@")[0] || "";
    if (lidId && from.phone !== lidId) {
      storage.saveLidMapping(sessionId, lidId, from.phone, contactName).catch((err) => {
        logger.log(`Failed to save LID mapping (non-blocking): ${err}`);
      });
    }
  }

  logger.log("Verifying if message is forwarded");
  const isForwarded = getIsForwarded(message);
  logger.log("Is message forwarded", isForwarded);

  const parsedMessage: MessageDto = {
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
    const uploadedFile = await processMediaFile(instance, message, content as FileMessageContent, logger);
    logger.log("Uploaded file", uploadedFile);
    return { ...parsedMessage, fileId: uploadedFile.id };
  }

  return parsedMessage;
}

function getMessageContent(message: WAMessage, logger: ProcessingLogger): MessageContent | FileMessageContent {
  logger.debug("Getting message content");
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
  const isLid = key.addressingMode === "lid" || key.remoteJid?.endsWith("@lid");

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

  // Para LID, tentar usar jidAlt (número real)
  if (isLid) {
    const jidAlt = key.remoteJidAlt || "";
    const phone = jidAlt.split("@")[0] || "";
    return {
      phone,
      isGroup: false,
      lid: key.remoteJid?.split("@")[0] || "",
    };
  }

  // Para JID normal (não-LID), extrair do remoteJid
  const jid = key.remoteJid || "";
  const phone = jid.split("@")[0];

  return {
    phone: phone || key.remoteJid || "",
    isGroup: false,
  };
}

/**
 * Resolve o remetente de uma mensagem, buscando o telefone real quando for um LID.
 * Fluxo:
 * 1. Tenta extrair do key (remoteJidAlt, participantAlt)
 * 2. Se for LID sem telefone, consulta o banco de dados (lid_mapping)
 * 3. Se não encontrar, loga o problema e retorna o LID como fallback
 */
async function resolveMessageFrom(
  key: WAMessageKey,
  storage: DataClient,
  sessionId: string,
  logger: ProcessingLogger
): Promise<{ phone: string; isGroup: boolean; groupId?: string }> {
  const result = getMessageFrom(key);

  // Se já tem telefone válido (não é LID), retorna direto
  if (result.phone && !result.phone.match(/^\d+$/) === false) {
    // Verificar se o telefone parece um número de telefone real (não um LID)
    // LIDs são números muito grandes sem código de país válido, mas não há forma 100% segura de distinguir
    // A melhor forma é checar se veio de um @lid
  }

  const isLid = key.addressingMode === "lid" || key.remoteJid?.endsWith("@lid");

  // Se não é LID ou já tem telefone, retorna
  if (!isLid || (result.phone && result.phone.length > 0)) {
    return result;
  }

  // É LID sem telefone - precisamos resolver
  const lidId = (result as any).lid || key.remoteJid?.split("@")[0] || "";

  if (!lidId) {
    logger.log("LID message without LID identifier, cannot resolve phone");
    return result;
  }

  logger.log(`Resolving LID to phone number: ${lidId}`);

  // 1. Consultar banco de dados local
  try {
    const phoneFromDb = await storage.getPhoneByLid(sessionId, lidId);
    if (phoneFromDb) {
      logger.log(`LID ${lidId} resolved from database: ${phoneFromDb}`);
      return {
        ...result,
        phone: phoneFromDb,
      };
    }
  } catch (error) {
    logger.log(`Error querying LID mapping from database: ${error}`);
  }

  // 2. Não encontrou - retorna o LID como fallback e loga o aviso
  logger.log(`WARNING: Could not resolve LID ${lidId} to a phone number. remoteJidAlt was empty and no mapping found in database.`);

  return {
    ...result,
    phone: result.phone || lidId,
  };
}

function getIsForwarded(message: WAMessage): boolean {
  return message.message?.extendedTextMessage?.contextInfo?.isForwarded || false;
}

function getMessageQuotedId(message: WAMessage): string | null {
  return message.message?.extendedTextMessage?.contextInfo?.stanzaId || null;
}

async function processMediaFile(instance: string, message: WAMessage, content: FileMessageContent, logger: ProcessingLogger) {
  logger.debug("Downloading media message", { fileName: content.fileName, fileSize: content.fileSize });

  const mediaBuffer = await downloadMediaMessage(message, "buffer", {});

  logger.debug("Media downloaded, uploading to storage", { bufferSize: mediaBuffer.length });


  const uploadedFile = await filesService.uploadFile({
    buffer: mediaBuffer,
    fileName: content.fileName,
    mimeType: content.fileType,
    dirType: FileDirType.PUBLIC,
    instance,
  });

  logger.debug("Media uploaded", { fileId: uploadedFile.id });

  return uploadedFile;
}

export default parseMessage;
