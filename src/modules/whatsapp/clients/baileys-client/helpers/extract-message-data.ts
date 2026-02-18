import { proto } from "baileys";
import InpulseMessage from "../../../inpulse-types";

export interface MessageContent {
  type: InpulseMessage["type"];
  body: string;
  isFile: false;
}

export interface FileMessageContent {
  type: InpulseMessage["type"];
  body: string;
  isFile: true;
  fileName: string;
  fileType: string;
  fileSize: string;
}

export type ExtractedMessageData = MessageContent | FileMessageContent;

export function extractMessageData(message: proto.IMessage): ExtractedMessageData {
  if (message?.extendedTextMessage?.text) {
    return {
      type: "chat",
      body: message.extendedTextMessage.text,
      isFile: false,
    };
  }

  if (message?.conversation) {
    return {
      type: "chat",
      body: message.conversation,
      isFile: false,
    };
  }
  if (message?.audioMessage) {
    return {
      body: message.conversation || "",
      type: "audio",
      fileName: "audio.ogg",
      fileType: message.audioMessage.mimetype || "audio/ogg; codecs=opus",
      fileSize: String(message.audioMessage.fileLength || 0),
      isFile: true,
    };
  }
  if (message?.imageMessage) {
    return {
      body: message.imageMessage?.caption || "",
      type: "image",
      fileName: "image.jpg",
      fileType: message.imageMessage.mimetype || "image/jpeg",
      fileSize: String(message.imageMessage.fileLength || 0),
      isFile: true,
    };
  }
  if (message?.videoMessage) {
    return {
      body: message.videoMessage?.caption || "",
      type: "video",
      fileName: "video.mp4",
      fileType: message.videoMessage.mimetype || "video/mp4",
      fileSize: String(message.videoMessage.fileLength || 0),
      isFile: true,
    };
  }
  if (message?.documentMessage) {
    return {
      body: message.documentMessage?.caption || "",
      type: "document",
      fileName: message.documentMessage?.fileName || "document",
      fileType: message.documentMessage.mimetype || "application/octet-stream",
      fileSize: String(message.documentMessage.fileLength || 0),
      isFile: true,
    };
  }
  if (message?.documentWithCaptionMessage) {
    const docMessage = message.documentWithCaptionMessage.message?.documentMessage;
    if (docMessage) {
      return {
        body: docMessage.caption || "",
        type: "document",
        fileName: docMessage.fileName || "document",
        fileType: docMessage.mimetype || "application/octet-stream",
        fileSize: String(docMessage.fileLength || 0),
        isFile: true,
      };
    }
  }
  if (message?.stickerMessage) {
    return {
      body: "",
      type: "sticker",
      fileName: "sticker.webp",
      fileType: message.stickerMessage.mimetype || "image/webp",
      fileSize: String(message.stickerMessage.fileLength || 0),
      isFile: true,
    };
  }

  if (message?.contactMessage) {
    const contact = message.contactMessage;
    const contactName = contact.displayName || "Contato";
    const contactNumber = contact.vcard?.split("TEL:")[1]?.split("\n")[0] || "Sem número";
    return {
      type: "contact",
      body: `📇 Contato: ${contactName} (${contactNumber})`,
      isFile: false,
    };
  }

  if (message?.locationMessage) {
    const location = message.locationMessage;
    const latitude = location.degreesLatitude;
    const longitude = location.degreesLongitude;
    return {
      type: "location",
      body: `📍 Localização: https://maps.google.com/maps?q=${latitude},${longitude}`,
      isFile: false,
    };
  }

  if (message?.bcallMessage) {
    return {
      type: "call",
      body: "☎️ Chamada",
      isFile: false,
    };
  }

  if (message?.viewOnceMessage) {
    return {
      type: "unsupported",
      body: "🔐 Mensagem com visualização única - Este tipo de mensagem só pode ser vista uma vez e não pode ser armazenada",
      isFile: false,
    };
  }

  if (message?.ephemeralMessage) {
    return {
      type: "unsupported",
      body: "⏰ Mensagem temporária - Este tipo de mensagem é configurada para desaparecer e não pode ser armazenada",
      isFile: false,
    };
  }

  if (message?.listMessage) {
    const listMsg = message.listMessage;
    const title = listMsg.title || "Lista";
    const description = listMsg.description || "Selecione uma opção";
    return {
      type: "unsupported",
      body: `📋 ${title}: ${description}\n⚠️ Este tipo de mensagem interativa (lista) deve ser visualizada no aplicativo WhatsApp`,
      isFile: false,
    };
  }

  if (message?.buttonsMessage) {
    const buttonsMsg = message.buttonsMessage;
    const buttonTexts = buttonsMsg.buttons?.map((b: any) => `• ${b.buttonText?.displayText || b.buttonId}`).join("\n") || "";
    return {
      type: "unsupported",
      body: `🔘 ${buttonsMsg.contentText}\n${buttonTexts}\n⚠️ Este tipo de mensagem interativa (botões) deve ser visualizada no aplicativo WhatsApp`,
      isFile: false,
    };
  }

  if (message?.templateMessage) {
    const templateMsg = message.templateMessage;
    return {
      type: "unsupported",
      body: `📧 Template: ${templateMsg.hydratedTemplate?.hydratedContentText || "Mensagem de template"}\n⚠️ Este tipo de mensagem de template deve ser visualizada no aplicativo WhatsApp`,
      isFile: false,
    };
  }

  if (message?.interactiveMessage) {
    const interactiveMsg = message.interactiveMessage;
    const body = interactiveMsg.body?.text || "Mensagem interativa";
    return {
      type: "unsupported",
      body: `💬 ${body}\n⚠️ Esta mensagem interativa deve ser visualizada no aplicativo WhatsApp`,
      isFile: false,
    };
  }

  if (message?.pollUpdateMessage) {
    return {
      type: "unsupported",
      body: "🗳️ Atualização de enquete - Esta mensagem deve ser visualizada no aplicativo WhatsApp",
      isFile: false,
    };
  }

  if (message?.pollCreationMessage) {
    const poll = message.pollCreationMessage;
    const options = poll.options?.map((opt: any) => `• ${opt.optionName}`).join("\n") || "";
    return {
      type: "unsupported",
      body: `🗳️ Enquete: ${poll.name}\n${options}\n⚠️ Enquetes devem ser respondidas no aplicativo WhatsApp`,
      isFile: false,
    };
  }

  if (message?.groupInviteMessage) {
    const groupInvite = message.groupInviteMessage;
    return {
      type: "unsupported",
      body: `👥 Convite para grupo: ${groupInvite.groupName || "Grupo"}\n⚠️ Convites de grupo devem ser aceitos no aplicativo WhatsApp`,
      isFile: false,
    };
  }

  return {
    type: "unsupported",
    body: "⚠️ Tipo de mensagem não suportado - Esta mensagem só pode ser visualizada no aplicativo WhatsApp",
    isFile: false,
  };
}