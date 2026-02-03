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
 * For groups: "120363400058576861" to "120363400058576861@g.us"
 */
function normalizeToJid(to: string, isGroup: boolean = false): string {
  // Remove any existing suffix
  const cleanId = to.replace(/@(s\.whatsapp\.net|g\.us)/, "").trim();

  // Validate it's a valid ID (only digits)
  if (!cleanId || !/^\d+$/.test(cleanId)) {
    throw new Error(`Invalid ${isGroup ? 'group' : 'phone'} ID format: ${to}`);
  }

  // Return with appropriate suffix based on whether it's a group or individual
  return isGroup ? `${cleanId}@g.us` : `${cleanId}@s.whatsapp.net`;
}

async function handleSendMessage({ client, options, isGroup, logger }: SendMessageContext, tryCount: number = 0) {
  try {
    logger.log(`Iniciando envio de mensagem para: ${options.to} (tentativa ${tryCount + 1})`);

    const normalizedTo = normalizeToJid(options.to, isGroup);
    logger.debug(`JID normalizado: ${normalizedTo} (isGroup: ${isGroup})`);

    const jid = jidNormalizedUser(normalizedTo);

    if (!jid) {
      throw new Error(`Failed to normalize JID for phone: ${options.to}`);
    }

    let messageOptions;
    try {
      messageOptions = getMessageOptions(options, logger);
      logger.debug(`Opções de mensagem preparadas`, { isGroup });
    } catch (error) {
      logger.log(`Erro ao preparar opções de mensagem: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }

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

    let message;
    try {
      message = await client._sock.sendMessage(jid, messageOptions);
    } catch (error) {
      logger.log(`Erro ao enviar mensagem via socket: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }

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
    logger.log(`Erro capturado: ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof Error && err.stack) {
      logger.debug(`Stack trace: ${err.stack}`);
    }
    
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

  logger.debug(`Preparando opções de arquivo`, { 
    fileType: options.fileType, 
    fileName, 
    mimeType,
    fileUrl: options.fileUrl,
    hasFileObject: !!options.file,
    text: options.text 
  });

  const isImage = mimeType.includes("image") || options.fileType === "image";
  const isVideo = mimeType.includes("video") || options.fileType === "video";
  const isAudio = mimeType.includes("audio") || options.fileType === "audio";

  logger.debug(`Tipo de mídia detectado`, { isImage, isVideo, isAudio });

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
    logger.debug(`Criando mensagem de áudio`, { url: options.fileUrl, mimeType });
    
    // Verificar se deve enviar como áudio ou PTT (Push-to-Talk)
    const shouldSendAsAudio = options.sendAsAudio !== false; // default true
    
    if (shouldSendAsAudio) {
      logger.debug(`Enviando como áudio (não PTT)`);
      return {
        audio: { url: options.fileUrl },
        mimetype: mimeType,
        ...(options.text ? { caption: options.text } : {}),
      };
    } else {
      logger.debug(`Enviando como PTT (áudio de voz)`);
      return {
        audio: { url: options.fileUrl },
        mimetype: mimeType,
        ptt: true,
        ...(options.text ? { caption: options.text } : {}),
      };
    }
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
