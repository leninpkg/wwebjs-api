import { BufferJSON, proto } from "baileys";
import { prisma } from "../../../../../../../prisma";
import resolveJson from "../resolve-json";

interface UpsertMessageDto {
  id: string;
  timestamp: string;
  remoteJid: string;
  keyData: proto.IMessageKey;
  messageData: proto.IMessage;
}

interface UpsertMessageMediaDto {
  messageId: string;
  inpulseId: number;
}

class MessagesRepository {
  constructor(
    private readonly sessionId: string,
    private readonly instance: string,
  ) { }

  public async upsert(message: UpsertMessageDto): Promise<void> {
    const keyData = JSON.stringify(message.keyData, BufferJSON.replacer);
    const messageData = JSON.stringify(message.messageData, BufferJSON.replacer);

    await prisma.rawMessage.upsert({
      where: { id: message.id },
      create: {
        id: message.id,
        instance: this.instance,
        timestamp: message.timestamp,
        remoteJid: message.remoteJid,
        sessionId: this.sessionId,
        keyData,
        messageData,
      },
      update: { keyData, messageData },
    });
  }

  public async update(id: string, messageData: proto.IMessage): Promise<void> {
    await prisma.rawMessage.update({
      where: { id },
      data: {
        messageData: JSON.stringify(messageData, BufferJSON.replacer),
      },
    });
  }

  public async findById(id: string) {
    const message = await prisma.rawMessage.findUnique({ where: { id } });
    if (!message) return null;

    const keyData = resolveJson<proto.IMessageKey>(message.keyData);
    const messageData = resolveJson<proto.IMessage>(message.messageData);

    return { ...message, keyData, messageData };
  }

  public async findMany(startTime?: Date, endTime?: Date, remoteJid?: string) {
    const where: {
      sessionId: string;
      instance: string;
      remoteJid?: string;
      timestamp?: {
        gte?: string;
        lte?: string;
      };
    } = {
      sessionId: this.sessionId,
      instance: this.instance,
    };

    if (remoteJid) {
      where.remoteJid = remoteJid;
    }

    if (startTime || endTime) {
      where.timestamp = {};

      if (startTime) {
        where.timestamp.gte = String(startTime.getTime());
      }

      if (endTime) {
        where.timestamp.lte = String(endTime.getTime());
      }
    }

    const messages = await prisma.rawMessage.findMany({
      where,
      orderBy: { timestamp: "asc" },
    });

    return messages.map(message => {
      const keyData = resolveJson<proto.IMessageKey>(message.keyData);
      const messageData = resolveJson<proto.IMessage>(message.messageData);
      return { ...message, keyData, messageData };
    });
  }

  public async insertMedia(media: UpsertMessageMediaDto) {
    return await prisma.rawMessageFile.create({
      data: {
        messageId: media.messageId,
        inpulseId: media.inpulseId,
      },
    });
  }

  public getMedia(messageId: string) {
    return prisma.rawMessageFile.findUnique({
      where: { messageId },
    });
  }
}

export default MessagesRepository;
