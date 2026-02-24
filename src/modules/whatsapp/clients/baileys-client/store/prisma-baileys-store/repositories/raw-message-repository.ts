import { BufferJSON, proto } from "baileys";
import { prisma } from "../../../../../../../prisma";
import resolveJson from "../resolve-json";

interface UpsertRawMessageInput {
  id: string;
  timestamp: string;
  remoteJid: string;
  keyData: proto.IMessageKey;
  messageData: proto.IMessage;
}

class RawMessageRepository {
  constructor(
    private readonly sessionId: string,
    private readonly instance: string,
  ) { }

  public async upsert(input: UpsertRawMessageInput): Promise<void> {
    const keyData = JSON.stringify(input.keyData, BufferJSON.replacer);
    const messageData = JSON.stringify(input.messageData, BufferJSON.replacer);

    await prisma.rawMessage.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        instance: this.instance,
        timestamp: input.timestamp,
        remoteJid: input.remoteJid,
        sessionId: this.sessionId,
        keyData,
        messageData,
      },
      update: { keyData, messageData },
    });
  }

  public async findById(id: string) {
    const message = await prisma.rawMessage.findUnique({ where: { id } });
    if (!message) return null;

    const keyData = resolveJson<proto.IMessageKey>(message.keyData);
    const messageData = resolveJson<proto.IMessage>(message.messageData);

    return { ...message, keyData, messageData };
  }

  public async updateMessageData(id: string, messageData: proto.IMessage): Promise<void> {
    const string = JSON.stringify(messageData, BufferJSON.replacer);
    const object = JSON.parse(string);

    await prisma.rawMessage.update({
      where: { id },
      data: {
        messageData: JSON.stringify(object, BufferJSON.replacer),
      },
    });
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
}

export default RawMessageRepository;
