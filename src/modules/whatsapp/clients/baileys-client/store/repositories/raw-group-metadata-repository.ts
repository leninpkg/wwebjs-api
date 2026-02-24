import { GroupMetadata } from "baileys";
import { prisma } from "../../../../../../prisma";

class RawGroupMetadataRepository {
  constructor(
    private readonly sessionId: string,
    private readonly instance: string,
  ) {}

  public async findByRemoteJid(remoteJid: string) {
    return prisma.rawGroupMetadata.findFirst({
      where: {
        remoteJid,
        sessionId: this.sessionId,
        instance: this.instance,
      },
    });
  }

  public async updateMetadata(id: string, metadata: GroupMetadata): Promise<void> {
    await prisma.rawGroupMetadata.update({
      where: { id },
      data: {
        metadata: JSON.stringify(metadata),
      },
    });
  }

  public async upsert(group: GroupMetadata): Promise<void> {
    await prisma.rawGroupMetadata.upsert({
      where: {
        id: `${this.sessionId}-${group.id}`,
      },
      create: {
        id: `${this.sessionId}-${group.id}`,
        remoteJid: group.id,
        instance: this.instance,
        sessionId: this.sessionId,
        metadata: JSON.stringify(group),
      },
      update: {
        metadata: JSON.stringify(group),
      },
    });
  }

  public async findMany() {
    return prisma.rawGroupMetadata.findMany({
      where: {
        sessionId: this.sessionId,
        instance: this.instance,
      },
    });
  }
}

export default RawGroupMetadataRepository;
