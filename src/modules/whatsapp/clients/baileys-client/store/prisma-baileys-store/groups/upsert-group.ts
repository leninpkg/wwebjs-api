import { GroupMetadata } from "baileys";
import { ILogger } from "baileys/lib/Utils/logger";
import GroupsRepository from "./groups-repository";

interface UpsertGroupDto {
  group: GroupMetadata;
  logger: ILogger;
  repository: GroupsRepository;
}

async function upsertGroup({ group, logger, repository }: UpsertGroupDto) {
  try {
    await repository.upsert(group.id, group);
    logger.info(`Group with ID ${group.id} upserted successfully`);
  } catch (err) {
    logger.error(err, `Failed to upsert group with ID ${group.id}`);
  }
}

export default upsertGroup;