import { AuthenticationCreds, AuthenticationState } from "baileys";

abstract class BaileysAuth {
  abstract get sessionId(): string;
  abstract get creds(): AuthenticationCreds;
  abstract get state(): AuthenticationState;

  abstract saveCredentials(): Promise<void>;
  abstract removeCredentials(): Promise<void>;
  abstract clearData(): Promise<void>;
}

export default BaileysAuth;