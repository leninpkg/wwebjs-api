import { downloadMediaMessage, WAMessage } from "baileys";
import { ILogger } from "baileys/lib/Utils/logger";
import uploadFile from "../../../../../../files/upload-file";
import { extractMessageType } from "../../../helpers/get-message-type";
import { GetMessageMediaResult } from "../../baileys-store";
import MessagesRepository from "./messages-repository";

interface GetMessageMediaDto {
  instance: string;
  message: WAMessage;
  logger: ILogger;
  repository: MessagesRepository;
}

type ExtractedMediaInfo = {
  fileName: string;
  fileType: string;
  fileSize: number | null;
};

async function getMessageMedia({ instance, message, logger, repository }: GetMessageMediaDto): Promise<GetMessageMediaResult> {
  try {
    if (!message.key.id) {
      logger.warn({ message }, "Cannot get media for message without ID");
      return { success: false, reason: "Message ID is missing", media: null };
    }

    const existingMedia = await repository.getMedia(message.key.id);
    if (existingMedia?.inpulseId) {
      return { success: true, media: existingMedia };
    }

    const mediaInfo = extractMediaInfo(message);
    if (!mediaInfo) {
      logger.warn({ message, mediaInfo }, "Message does not contain downloadable media");
      return { success: false, reason: "Message does not contain downloadable media", media: null };
    }

    const mediaBuffer = await downloadMediaMessage(message, "buffer", {});
    const savedFile = await uploadFile(mediaBuffer, mediaInfo.fileName, mediaInfo.fileType, instance);
    const savedMedia = await repository.insertMedia({ messageId: message.key.id, inpulseId: savedFile.id });

    return { success: true, media: savedMedia };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error(err, `Failed to get media for message ${message.key.id}: ${errMsg}`);
    return { success: false, reason: errMsg, media: null };
  }
}

function extractMediaInfo(message: WAMessage): ExtractedMediaInfo | null {
  if (!message.message) {
    return null;
  }

  const mediaType = extractMessageType(message.message);

  if (!mediaType.isDownloadable) {
    return null;
  }

  if (message.message.documentWithCaptionMessage?.message?.documentMessage) {
    const documentMessage = message.message.documentWithCaptionMessage.message.documentMessage;

    return {
      fileName: documentMessage.fileName || "document",
      fileType: documentMessage.mimetype || "application/octet-stream",
      fileSize: documentMessage.fileLength ? Number(documentMessage.fileLength) : null,
    };
  }

  if (message.message.documentMessage) {
    return {
      fileName: message.message.documentMessage.fileName || "document",
      fileType: message.message.documentMessage.mimetype || "application/octet-stream",
      fileSize: message.message.documentMessage.fileLength ? Number(message.message.documentMessage.fileLength) : null,
    };
  }

  if (message.message.imageMessage) {
    return {
      fileName: "image.jpg",
      fileType: message.message.imageMessage.mimetype || "image/jpeg",
      fileSize: message.message.imageMessage.fileLength ? Number(message.message.imageMessage.fileLength) : null,
    };
  }

  if (message.message.videoMessage) {
    return {
      fileName: "video.mp4",
      fileType: message.message.videoMessage.mimetype || "video/mp4",
      fileSize: message.message.videoMessage.fileLength ? Number(message.message.videoMessage.fileLength) : null,
    };
  }

  if (message.message.audioMessage) {
    return {
      fileName: message.message.audioMessage.ptt ? "audio.ogg" : "audio",
      fileType: message.message.audioMessage.mimetype || "audio/ogg; codecs=opus",
      fileSize: message.message.audioMessage.fileLength ? Number(message.message.audioMessage.fileLength) : null,
    };
  }

  if (message.message.stickerMessage) {
    return {
      fileName: "sticker.webp",
      fileType: message.message.stickerMessage.mimetype || "image/webp",
      fileSize: message.message.stickerMessage.fileLength ? Number(message.message.stickerMessage.fileLength) : null,
    };
  }

  return null;
}

export default getMessageMedia;