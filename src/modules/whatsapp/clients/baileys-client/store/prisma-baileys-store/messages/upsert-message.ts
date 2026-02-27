import { WAMessage } from "baileys";
import { ILogger } from "baileys/lib/Utils/logger";
import MessagesRepository from "./messages-repository";
import shouldIgnoreMessage from "../../../helpers/should-ignore-message";

interface UpsertMessageInput {
  message: WAMessage;
  logger: ILogger;
  repository: MessagesRepository;
}

async function upsertMessage({ message, logger, repository }: UpsertMessageInput) {
  try {
    const { ignore, reason } = shouldIgnoreMessage(message);

    if (ignore) {
      logger.info(`Message with ID ${message.key.id} ignored: ${reason}`);
      return;
    }

    await repository.upsert({
      id: message.key.id!,
      timestamp: String(message.messageTimestamp),
      remoteJid: message.key.remoteJid!,
      keyData: message.key,
      messageData: message.message!,
    })
    logger.info(`Message with ID ${message.key.id} upserted successfully`);
  } catch (err) {
    logger.error(err, `Failed to upsert message with ID ${message.key.id}`);
  }
}

export default upsertMessage;