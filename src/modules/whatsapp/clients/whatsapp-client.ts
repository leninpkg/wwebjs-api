import type MessageDto from "../types";
import type { EditMessageOptions, FetchMessageHistoryOptions, FetchMessageHistoryResult, SendMessageOptions, Mentions } from "../types";

abstract class WhatsappClient {
  public abstract readonly sessionId: string;

  public abstract isValidWhatsapp(phone: string): Promise<boolean>;
  public abstract sendMessage(props: SendMessageOptions, isGroup?: boolean): Promise<MessageDto>;
  public abstract editMessage(props: EditMessageOptions): Promise<MessageDto>;
  public abstract getAvatarUrl(phone: string): Promise<string | null>;
  public abstract getGroups(): Promise<Array<{ id: string; name: string }>>;
  public abstract getTextWithMentions(text: string, mentions?: Mentions): Promise<{ text: string; mentions: string[] }>;
}

export default WhatsappClient;
