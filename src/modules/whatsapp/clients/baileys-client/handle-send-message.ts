import { Logger } from "@in.pulse-crm/utils";
import { AnyMediaMessageContent, AnyRegularMessageContent, jidNormalizedUser } from "baileys";
import { phoneToAltBr } from "../../../../utils/phone.utils";
import ProcessingLogger from "../../../../utils/processing-logger";
import { calculateTypingDuration, sleep } from "../../../../utils/humanize.utils";
import { SendFileOptions, SendMessageOptions } from "../../types";
import BaileysWhatsappClient from "./baileys-whatsapp-client";
import parseMessage from "./parse-message";

interface SendMessageContext {
  client: BaileysWhatsappClient;
  options: SendMessageOptions;
  isGroup: boolean;
  logger: ProcessingLogger;
}

/**
 * Normalize phone number to JID format
 * Converts "5511999999999" to "5511999999999@s.whatsapp.net"
 */
function normalizeToJid(to: string): string {
  // Remove any existing @s.whatsapp.net suffix
  const cleanPhone = to.replace("@s.whatsapp.net", "").trim();

  // Validate it's a valid phone number
  if (!cleanPhone || !/^\d+$/.test(cleanPhone)) {
    throw new Error(`Invalid phone number format: ${to}`);
  }

  return `${cleanPhone}@s.whatsapp.net`;
}

async function handleSendMessage({ client, options, isGroup, logger }: SendMessageContext, tryCount: number = 0) {
  try {
    logger.log(`Iniciando envio de mensagem para: ${options.to} (tentativa ${tryCount + 1})`);

    const normalizedTo = normalizeToJid(options.to);
    logger.debug(`JID normalizado: ${normalizedTo}`);

    const jid = jidNormalizedUser(normalizedTo);

    if (!jid) {
      throw new Error(`Failed to normalize JID for phone: ${options.to}`);
    }

    const messageOptions = getMessageOptions(options, logger);
    logger.debug(`Opções de mensagem preparadas`, { isGroup });

    // Simular digitação para humanizar a interação
    const messageText = options.text || "";

    if (messageText) {
      const typingDuration = calculateTypingDuration({
        messageLength: messageText.length,
        minSpeed: 30, // ms por caractere
        maxSpeed: 60, // ms por caractere
      });

      logger.debug(`Simulando digitação por ${typingDuration}ms`);

      // Enviar estado de digitação
      await client._sock.sendPresenceUpdate("composing", jid);
      logger.debug(`Estado de digitação enviado para: ${jid}`);

      await sleep(typingDuration);

      // Parar de enviar estado de digitação
      await client._sock.sendPresenceUpdate("paused", jid);
      logger.debug(`Estado de pausa enviado para: ${jid}`);
    }

    const message = await client._sock.sendMessage(jid, messageOptions);

    if (!message) {
      throw new Error("Failed to send message");
    }

    logger.log(`Mensagem enviada com sucesso para: ${jid}`);

    const parsedMessage = parseMessage({
      message,
      instance: client.instance,
      clientId: client.clientId,
      phone: client.phone,
      logger,
    });

    Logger.debug("Mensagem parseada com sucesso", parsedMessage);
    logger.success(parsedMessage);
    return parsedMessage;
  } catch (err) {
    if (tryCount == 0) {
      logger.log(`Falha na primeira tentativa, convertendo para formato alternativo`);
      options.to = phoneToAltBr(options.to);
      return handleSendMessage({ client, options, isGroup, logger }, tryCount + 1);
    }
    throw err;
  }
}

function getMessageOptions(options: SendMessageOptions, logger: ProcessingLogger): AnyRegularMessageContent {
  logger.debug(`Preparando opções de mensagem`);
  const isFileMessage = "fileUrl" in options;
  logger.debug(`Tipo de mensagem: ${isFileMessage ? "arquivo" : "texto"}`);

  if (isFileMessage) {
    logger.debug(`Processando mensagem de arquivo`);
    return getFileMessageOptions(options as SendFileOptions, logger);
  }
  if (!options.text) {
    throw new Error("Text message must have 'text' property");
  }
  logger.debug(`Criando mensagem de texto: ${options.text.substring(0, 50)}...`);
  return {
    text: options.text || "",
  };
}

function getFileMessageOptions(options: SendFileOptions, logger: ProcessingLogger): AnyMediaMessageContent {
  // Extrair informações do arquivo do objeto file, se disponível
  const fileName = options.fileName || options.file?.name || "file";
  const mimeType = options.file?.mime_type || options.fileType || "application/octet-stream";

  logger.debug(`Preparando opções de arquivo`, { fileType: options.fileType, fileName, mimeType });

  const isImage = mimeType.includes("image") || options.fileType === "image";
  const isVideo = mimeType.includes("video") || options.fileType === "video";
  const isAudio = mimeType.includes("audio") || options.fileType === "audio";

  if (isImage) {
    logger.debug(`Criando mensagem de imagem`, { url: options.fileUrl });
    return {
      image: { url: options.fileUrl },
      ...(options.text ? { caption: options.text } : {}),
    };
  }
  if (isVideo) {
    logger.debug(`Criando mensagem de vídeo`, { url: options.fileUrl });
    return {
      video: { url: options.fileUrl },
      ...(options.text ? { caption: options.text } : {}),
    };
  }
  if (isAudio) {
    logger.debug(`Criando mensagem de áudio`, { url: options.fileUrl });
    return {
      audio: { url: options.fileUrl },
      ...(options.text ? { caption: options.text } : {}),
    };
  }

  logger.debug(`Criando mensagem de documento`, { fileName, mimeType });
  return {
    document: {
      url: options.fileUrl,
    },
    mimetype: mimeType,
    fileName: fileName,
    ...(options.text ? { caption: options.text } : {}),
  };
}

export default handleSendMessage;
