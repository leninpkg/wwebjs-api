import { MediaType, proto, WAMessage } from "baileys";

interface DownloadableMessage {
  type: MediaType;
  isDownloadable: true;
}

interface UndownloadableMessage {
  type: Exclude<string, MediaType>;
  isDownloadable: false;
}

export function extractMessageType(message: proto.IMessage): DownloadableMessage | UndownloadableMessage {
  if (message.audioMessage && message.audioMessage.ptt) return { type: "ptt", isDownloadable: true };
  if (message.audioMessage) return { type: "audio", isDownloadable: true };
  if (message.documentMessage) return { type: "document", isDownloadable: true };
  if (message.documentWithCaptionMessage) return { type: "document", isDownloadable: true };
  if (message.imageMessage) return { type: "image", isDownloadable: true };
  if (message.stickerMessage) return { type: "sticker", isDownloadable: true };
  if (message.videoMessage) return { type: "video", isDownloadable: true };

  if (message.conversation) return { type: "chat", isDownloadable: false };
  if (message.extendedTextMessage) return { type: "chat", isDownloadable: false };
  if (message.contactMessage) return { type: "contact", isDownloadable: false };
  if (message.locationMessage) return { type: "location", isDownloadable: false };
  if (message.liveLocationMessage) return { type: "live_location", isDownloadable: false };
  if (message.pollCreationMessage) return { type: "poll_creation", isDownloadable: false };
  if (message.pollUpdateMessage) return { type: "poll_update", isDownloadable: false };
  if (message.listMessage) return { type: "list", isDownloadable: false };
  if (message.buttonsMessage) return { type: "buttons", isDownloadable: false };
  if (message.templateMessage) return { type: "template", isDownloadable: false };
  if (message.viewOnceMessage) return { type: "view_once", isDownloadable: false };

  return { type: "unsupported", isDownloadable: false };

}