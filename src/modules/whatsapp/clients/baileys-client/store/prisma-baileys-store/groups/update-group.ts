import { GroupMetadata } from "baileys";
import { ILogger } from "baileys/lib/Utils/logger";
import GroupsRepository from "./groups-repository";

interface UpdateGroupDto {
  group: Partial<GroupMetadata>;
  logger: ILogger;
  repository: GroupsRepository;
}

async function updateGroup({ group, logger, repository }: UpdateGroupDto) {
  try {
    if (!group.id) {
      logger.warn("Group ID is missing, skipping update");
      return;
    };

    const existing = await repository.findById(group.id);
    if (!existing) {
      logger.warn(`Group with ID ${group.id} not found, skipping update`);
      return;
    }

    const updatedName = group.subject || existing.name || undefined;
    const updatedMetadata = { ...existing.groupData, ...group };

    await repository.upsert(group.id, updatedMetadata, updatedName);
    logger.info(`Group with ID ${group.id} updated successfully`);
  } catch (err) {
    logger.error(err, `Failed to update group with ID ${group.id}`);
  }
}

export default updateGroup;