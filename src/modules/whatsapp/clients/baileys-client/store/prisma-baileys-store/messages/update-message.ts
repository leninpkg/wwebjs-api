import { WAMessageUpdate } from "baileys";
import { ILogger } from "baileys/lib/Utils/logger";
import MessagesRepository from "./messages-repository";

interface UpdateMessageDto {
  update: WAMessageUpdate;
  logger: ILogger;
  repository: MessagesRepository;
}

async function updateMessage({ update, logger, repository }: UpdateMessageDto) {
  try {
    if (!update.key.id) {
      logger.warn({ update }, "Received message update without ID, skipping");
      return;
    }

    const existing = await repository.findById(update.key.id);
    if (!existing) {
      logger.warn({ update }, `Received update for message ID ${update.key.id} which does not exist in the database, skipping`);
      return;
    }

    logger.debug(existing.messageData, 'Existing message data');
    logger.debug(update.update.message, 'Update message data');

    const newMessageData = { ...existing.messageData, ...update.update.message };
    logger.debug(newMessageData, 'Merged message data');

    await repository.update(update.key.id, newMessageData);
    logger.info({ update, updateMsgData: newMessageData, }, `Message with ID ${update.key.id} updated successfully`);
  } catch (err) {
    logger.error(err, `Failed to update message with ID ${update.key.id}`);
  }
}

export default updateMessage;