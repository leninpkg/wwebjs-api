import { WAMessageUpdate } from "baileys";
import ProcessingLogger from "../../../../helpers/processing-logger";
import BaileysWhatsappClient from "./baileys-whatsapp-client";
import handleMessageAck from "./handle-message-ack";

interface MessageUpdateContext {
  client: BaileysWhatsappClient;
  logger: ProcessingLogger;
  updates: WAMessageUpdate[];
}

async function handleMessageUpdate({ client, logger, updates }: MessageUpdateContext) {
  logger.log(`Received messages update`, { updateCount: updates.length });

  for (const update of updates) {
    if (!!update.update.status) {
      logger.log("Processing message status update", { messageId: update.key.id, status: update.update.status });
      await handleMessageAck({ client, ack: update.update.status, logger, msgId: update.key.id! });
    }
  }

  logger.success({ processedUpdates: updates.length });
}

export default handleMessageUpdate;
