import { WAMessage } from "baileys";
import { ILogger } from "baileys/lib/Utils/logger";
import MessagesRepository from "./messages-repository";
import shouldIgnoreMessage from "../../../helpers/should-ignore-message";
import getMessageMedia from "./get-message-media";
import { extractMessageType } from "../../../helpers/get-message-type";

interface UpsertMessageDto {
  instance: string;
  message: WAMessage;
  logger: ILogger;
  repository: MessagesRepository;
}

async function upsertMessage({ instance, message, logger, repository }: UpsertMessageDto): Promise<boolean> {
  try {
    const { ignore, reason } = shouldIgnoreMessage(message);

    if (ignore) {
      logger.info(`Message with ID ${message.key.id} ignored: ${reason}`);
      return false;
    }

    await repository.insert({
      id: message.key.id!,
      timestamp: String(message.messageTimestamp),
      remoteJid: message.key.remoteJid!,
      keyData: message.key,
      messageData: message.message!,
    });

    const { isDownloadable } = extractMessageType(message.message!);

    if (isDownloadable) {
      await getMessageMedia({ instance, message, logger, repository });
      logger.info(`Media for message with ID ${message.key.id} processed successfully`);
    }
    logger.info(`Message with ID ${message.key.id} upserted successfully`);
    return true;
  } catch (err) {
    logger.error(err, `Failed to upsert message with ID ${message.key.id}`);
    return false;
  }
}

export default upsertMessage;