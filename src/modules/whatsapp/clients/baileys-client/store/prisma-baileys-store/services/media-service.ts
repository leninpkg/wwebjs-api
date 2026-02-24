import { downloadMediaMessage, WAMessage } from "baileys";
import uploadFile from "../../../../../../files/upload-file";
import { extractMessageType } from "../../../helpers/get-message-type";
import { MessageFile } from "../../../types";
import RawMessageFileRepository from "../repositories/raw-message-file-repository";

interface UploadedFileLike {
  id?: number;
  filePath?: string;
  path?: string;
  url?: string;
}

class MediaService {
  constructor(
    private readonly instance: string,
    private readonly sessionId: string,
    private readonly rawMessageFileRepository: RawMessageFileRepository,
  ) { }

  public async getMessageMedia(message: WAMessage): Promise<MessageFile> {
    const messageId = message.key.id;

    if (!messageId) {
      throw new Error("Cannot download media: message id is missing");
    }

    const existingFile = await this.rawMessageFileRepository.findByMessageId(messageId);

    if (existingFile?.inpulseId && existingFile.filePath) {
      return {
        messageId: existingFile.messageId,
        inpulseId: existingFile.inpulseId,
        fileName: existingFile.fileName,
        fileType: existingFile.fileType,
        fileSize: existingFile.fileSize,
        filePath: existingFile.filePath,
      };
    }

    const mediaInfo = MediaService.extractMediaInfo(message);

    if (!mediaInfo) {
      throw new Error(`Message ${messageId} does not contain downloadable media`);
    }

    const mediaBuffer = await downloadMediaMessage(message, "buffer", {});
    const uploadedFile = await uploadFile(mediaBuffer, mediaInfo.fileName, mediaInfo.fileType, this.instance) as UploadedFileLike;

    const inpulseId = typeof uploadedFile.id === "number" ? uploadedFile.id : (existingFile?.inpulseId ?? null);
    const filePath = uploadedFile.filePath || uploadedFile.path || uploadedFile.url || existingFile?.filePath || `files-api://${inpulseId ?? messageId}`;

    const savedFile = await this.rawMessageFileRepository.upsert({
      id: existingFile?.id || `${this.sessionId}-${messageId}`,
      messageId,
      inpulseId,
      fileName: mediaInfo.fileName,
      fileType: mediaInfo.fileType,
      fileSize: mediaInfo.fileSize,
      filePath,
    });

    return {
      messageId: savedFile.messageId,
      inpulseId: savedFile.inpulseId,
      fileName: savedFile.fileName,
      fileType: savedFile.fileType,
      fileSize: savedFile.fileSize,
      filePath: savedFile.filePath,
    };
  }

  private static extractMediaInfo(message: WAMessage): Pick<MessageFile, "fileName" | "fileType" | "fileSize"> | null {
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

  public static isDownloadableMessage(message: WAMessage): boolean {
    if (!message.message) {
      return false;
    }
    const mediaType = extractMessageType(message.message);
    return mediaType.isDownloadable;
  }
}

export default MediaService;
