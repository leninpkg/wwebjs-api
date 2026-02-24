import { prisma } from "../../../../../../../prisma";

interface UpsertRawMessageFileInput {
  id: string;
  messageId: string;
  inpulseId: number | null;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  filePath: string;
}

class RawMessageFileRepository {
  public async findByMessageId(messageId: string) {
    return prisma.rawMessageFile.findUnique({
      where: { messageId },
    });
  }

  public async upsert(input: UpsertRawMessageFileInput) {
    return prisma.rawMessageFile.upsert({
      where: { messageId: input.messageId },
      create: {
        id: input.id,
        messageId: input.messageId,
        inpulseId: input.inpulseId,
        fileName: input.fileName,
        fileType: input.fileType,
        fileSize: input.fileSize,
        filePath: input.filePath,
      },
      update: {
        inpulseId: input.inpulseId,
        fileName: input.fileName,
        fileType: input.fileType,
        fileSize: input.fileSize,
        filePath: input.filePath,
      },
    });
  }
}

export default RawMessageFileRepository;
