import type MessageDto from "../types";
import type { EditMessageOptions, FetchMessageHistoryOptions, FetchMessageHistoryResult, SendMessageOptions } from "../types";

abstract class WhatsappClient {
  public abstract readonly sessionId: string;

  public abstract isValidWhatsapp(phone: string): Promise<boolean>;
  public abstract sendMessage(props: SendMessageOptions): Promise<MessageDto>;
  public abstract editMessage(props: EditMessageOptions): Promise<MessageDto>;
  public abstract getAvatarUrl(phone: string): Promise<string | null>;
  public abstract fetchMessageHistory(options: FetchMessageHistoryOptions): Promise<FetchMessageHistoryResult>;
}

export default WhatsappClient;
