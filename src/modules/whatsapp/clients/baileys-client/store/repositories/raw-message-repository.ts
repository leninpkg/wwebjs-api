import { BufferJSON, proto } from "baileys";
import { prisma } from "../../../../../../prisma";

interface UpsertRawMessageInput {
  id: string;
  timestamp: string;
  remoteJid: string;
  keyData: proto.IMessageKey;
  messageData: proto.IMessage;
  useBufferJSON?: boolean;
}

class RawMessageRepository {
  constructor(
    private readonly sessionId: string,
    private readonly instance: string,
  ) {}

  public async upsert(input: UpsertRawMessageInput): Promise<void> {
    const useBufferJSON = input.useBufferJSON ?? true;

    await prisma.rawMessage.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        instance: this.instance,
        timestamp: input.timestamp,
        remoteJid: input.remoteJid,
        sessionId: this.sessionId,
        keyData: this.stringify(input.keyData, useBufferJSON),
        messageData: this.stringify(input.messageData, useBufferJSON),
      },
      update: {
        keyData: this.stringify(input.keyData, useBufferJSON),
        messageData: this.stringify(input.messageData, useBufferJSON),
      },
    });
  }

  public async findById(id: string) {
    return prisma.rawMessage.findUnique({ where: { id } });
  }

  public async updateMessageData(id: string, messageData: proto.IMessage): Promise<void> {
    await prisma.rawMessage.update({
      where: { id },
      data: {
        messageData: JSON.stringify(messageData),
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

    return prisma.rawMessage.findMany({
      where,
      orderBy: { timestamp: "asc" },
    });
  }

  private stringify(value: unknown, useBufferJSON: boolean): string {
    if (useBufferJSON) {
      return JSON.stringify(value, BufferJSON.replacer);
    }

    return JSON.stringify(value);
  }
}

export default RawMessageRepository;
