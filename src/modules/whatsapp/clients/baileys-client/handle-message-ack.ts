import ProcessingLogger from "../../../../helpers/processing-logger";
import BaileysWhatsappClient from "./baileys-whatsapp-client";
import parseAck from "./parse-ack";

interface MessageAckContext {
  client: BaileysWhatsappClient;
  logger: ProcessingLogger;
  msgId: string;
  ack: number;
}

async function handleMessageAck({ client, logger, msgId, ack }: MessageAckContext) {
  const status = parseAck(ack);
  logger.log(`Message with ID ${msgId} updated with status: ${status}`);
  client._ev.emit({
    type: "message-status-received",
    clientId: client.clientId,
    messageId: msgId,
    status,
    timestamp: Date.now(),
  });
}

export default handleMessageAck;
