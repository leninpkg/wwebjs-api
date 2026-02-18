import type InpulseMessage from "../inpulse-types";
import type { EditMessageRequest, SendMessageRequest } from "../inpulse-types";

export interface GroupInfo {
  id: string;
  name: string;
}

abstract class WhatsappClient {
  public abstract readonly sessionId: string;

  public abstract isValidWhatsapp(phone: string): Promise<boolean>;
  public abstract sendMessage(props: SendMessageRequest, isGroup?: boolean): Promise<InpulseMessage>;
  public abstract editMessage(props: EditMessageRequest): Promise<InpulseMessage>;
  public abstract getAvatarUrl(phone: string): Promise<string | null>;
  public abstract getGroups(): Promise<GroupInfo[]>;
}

export default WhatsappClient;
