import { ILogger } from "baileys/lib/Utils/logger";
import WppEventEmitter from "../events/emitter/emitter";
import InpulseMessage from "../whatsapp/inpulse-types";

interface MessageReceiveOptions {
  emitter: WppEventEmitter;
  messageId: string;
  message: InpulseMessage;
  logger: ILogger;
}

async function messageReceive({ emitter, messageId, message, logger }: MessageReceiveOptions): Promise<void> {
  try {
    await emitter.emit({
      type: "message-received",
      clientId: message.clientId,
      message,
    });
    logger.info(`Emitted message-received event for message ${messageId}`);
  } catch (err) {
    logger.error(err, `Error processing received message ${messageId}`);
  }
}

export default messageReceive;