import { BufferJSON, GroupMetadata } from "baileys";
import { prisma } from "../../../../../../../prisma";
import resolveJson from "../resolve-json";
import { RawGroupMetadata } from "../../../types";

class RawGroupMetadataRepository {
  constructor(
    private readonly sessionId: string,
    private readonly instance: string,
  ) { }

  public async findByRemoteJid(remoteJid: string): Promise<RawGroupMetadata | null> {
    const group = await prisma.rawGroupMetadata.findFirst({
      where: {
        remoteJid,
        sessionId: this.sessionId,
        instance: this.instance,
      },
    });

    if (!group) return null;

    return {
      ...group,
      groupMetadata: resolveJson<GroupMetadata>(group.metadata),
    };
  }

  public async updateMetadata(id: string, metadata: GroupMetadata): Promise<void> {
    await prisma.rawGroupMetadata.update({
      where: { id },
      data: {
        metadata: JSON.stringify(metadata, BufferJSON.replacer),
      },
    });
  }

  public async upsert(group: GroupMetadata): Promise<void> {
    await prisma.rawGroupMetadata.upsert({
      where: {
        id: group.id,
        sessionId: this.sessionId,
      },
      create: {
        id: group.id,
        sessionId: this.sessionId,
        remoteJid: group.id,
        instance: this.instance,
        metadata: JSON.stringify(group, BufferJSON.replacer),
      },
      update: {
        metadata: JSON.stringify(group, BufferJSON.replacer),
      },
    });
  }

  public async findMany() {
    const groups = await prisma.rawGroupMetadata.findMany({
      where: {
        sessionId: this.sessionId,
        instance: this.instance,
      },
    });
    return groups.map(group => ({
      ...group,
      groupMetadata: resolveJson<GroupMetadata>(group.metadata),
    }))
  }
}

export default RawGroupMetadataRepository;
