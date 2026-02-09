import { Logger } from "@in.pulse-crm/utils";
import { AnyMediaMessageContent, AnyRegularMessageContent, jidNormalizedUser } from "baileys";
import { phoneToAltBr } from "../../../../utils/phone.utils";
import ProcessingLogger from "../../../../utils/processing-logger";
import { calculateTypingDuration, sleep } from "../../../../utils/humanize.utils";
import { SendFileOptions, SendMessageOptions } from "../../types";
import BaileysWhatsappClient from "./baileys-whatsapp-client";
import parseMessage from "./parse-message";
import filesService from "../../../files/files.service";

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
      messageOptions = await getMessageOptions(options, logger);
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
      storage: client._storage,
      sessionId: client.sessionId,
      sock: client._sock,
    });

    // Adicionar delay aleatório entre 3-8 segundos para simular comportamento humano
    const randomDelay = Math.floor(Math.random() * 5000) + 3000; // 3000-8000ms
    logger.debug(`Aguardando ${randomDelay}ms antes da próxima mensagem (comportamento humanizado)`);
    await sleep(randomDelay);

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

async function getMessageOptions(options: SendMessageOptions, logger: ProcessingLogger): Promise<AnyRegularMessageContent> {
  logger.debug(`Preparando opções de mensagem`);
  const isFileMessage = "fileUrl" in options;
  logger.debug(`Tipo de mensagem: ${isFileMessage ? "arquivo" : "texto"}`);

  if (isFileMessage) {
    logger.debug(`Processando mensagem de arquivo`);
    return await getFileMessageOptions(options as SendFileOptions, logger);
  }
  if (!options.text) {
    throw new Error("Text message must have 'text' property");
  }
  logger.debug(`Criando mensagem de texto: ${options.text.substring(0, 50)}...`);
  return {
    text: options.text || "",
  };
}

async function getFileMessageOptions(options: SendFileOptions, logger: ProcessingLogger): Promise<AnyMediaMessageContent> {
  // Extrair informações do arquivo
  const fileName = options.fileName || options.file?.name || "file";

  // IMPORTANTE: Priorizar o fileType que vem do backend, pois já foi processado corretamente
  // options.file?.mime_type pode estar incorreto (application/octet-stream)
  const fileId = Number(options.fileUrl.split("/").pop() || "") || null;
  const metadata = fileId ? await filesService.fetchFileMetadata(fileId) : null;

  let mimeType = metadata?.mime_type || options.file?.mime_type || "application/octet-stream";

  logger.debug(`Preparando opções de arquivo`, {
    fileType: options.fileType,
    fileName,
    mimeType,
    originalMimeType: options.file?.mime_type,
    fileUrl: options.fileUrl,
    hasFileObject: !!options.file,
    text: options.text,
    sendAsAudio: options.sendAsAudio,
    sendAsDocument: options.sendAsDocument
  });

  let fileType: string = options.fileType || "";

  if (!fileType) {
    if (mimeType.startsWith("image/")) {
      fileType = "image";
    }
    else if (mimeType.startsWith("video/")) {
      fileType = "video";
    }
    else if (mimeType.startsWith("audio/")) {
      fileType = "audio";
    }
    else {
      fileType = "document";
    }
  }

  // Se sendAsDocument = true, força envio como documento
  if (options.sendAsDocument) {
    logger.debug(`Enviando como documento (sendAsDocument = true)`, { fileName, mimeType });
    return {
      document: { url: options.fileUrl },
      mimetype: mimeType,
      fileName: fileName,
      ...(options.text ? { caption: options.text } : {}),
    };
  }

  logger.debug(`Verificando tipo de arquivo`, { fileType });

  // Verificar tipo de arquivo por fileType
  if (fileType === "image") {
    logger.debug(`Criando mensagem de imagem`, { url: options.fileUrl, mimeType });
    return {
      image: { url: options.fileUrl },
      ...(options.text ? { caption: options.text } : {}),
    };
  }

  if (fileType === "video") {
    logger.debug(`Criando mensagem de vídeo`, { url: options.fileUrl, mimeType });
    return {
      video: { url: options.fileUrl },
      ...(options.text ? { caption: options.text } : {}),
    };
  }

  if (fileType === "audio") {
    logger.debug(`Criando mensagem de áudio`, { url: options.fileUrl, mimeType, sendAsAudio: options.sendAsAudio });

    // sendAsAudio = false significa PTT (mensagem de voz)
    // sendAsAudio = true significa áudio normal
    const isPTT = options.sendAsAudio === false;

    if (isPTT) {
      logger.debug(`Enviando como PTT (mensagem de voz)`);
      return {
        audio: { url: options.fileUrl },
        mimetype: mimeType,
        ptt: true,
      };
    } else {
      logger.debug(`Enviando como áudio normal`);
      return {
        audio: { url: options.fileUrl },
        mimetype: mimeType,
      };
    }
  }

  // Fallback: documento
  logger.debug(`Enviando como documento (fallback)`, { fileName, mimeType, fileType });
  return {
    document: { url: options.fileUrl },
    mimetype: mimeType,
    fileName: fileName,
    ...(options.text ? { caption: options.text } : {}),
  };
}

export default handleSendMessage;
