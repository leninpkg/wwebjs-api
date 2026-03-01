import { BufferJSON, GroupMetadata } from "baileys";
import { prisma } from "../../../../../../../prisma";
import reviveJSON from "../resolve-json";
import { RawGroup } from "../../../types";

class GroupsRepository {
  constructor(
    private readonly sessionId: string,
    private readonly instance: string,
  ) { }

  public async findById(id: string): Promise<RawGroup | null> {
    const foundGroup = await prisma.rawGroup.findUnique({ where: { id } });
    if (!foundGroup) return null;

    const groupData = reviveJSON<GroupMetadata>(foundGroup.groupData);
    return { ...foundGroup, groupData };
  }

  public async upsert(id: string, group: Partial<GroupMetadata>, name?: string): Promise<void> {
    const groupName = name || group.subject || null;
    const groupData = JSON.stringify(group, BufferJSON.replacer);

    await prisma.rawGroup.upsert({
      where: {
        id,
        sessionId: this.sessionId,
      },
      create: {
        id,
        name: groupName,
        sessionId: this.sessionId,
        instance: this.instance,
        groupData,
      },
      update: {
        groupData,
        ...(groupName ? { name: groupName } : {}),
      },
    });
  }

  public async findMany() {
    const groups = await prisma.rawGroup.findMany({
      where: {
        sessionId: this.sessionId,
        instance: this.instance,
      },
    });
    
    return groups.map(group => ({
      ...group,
      groupData: reviveJSON<GroupMetadata>(group.groupData),
    }))
  }
}

export default GroupsRepository;
