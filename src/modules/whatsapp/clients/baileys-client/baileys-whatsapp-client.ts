import makeWASocket from "baileys";
import "dotenv/config";
import WppEventEmitter from "../../../events/emitter/emitter";
import type InpulseMessage from "../../inpulse-types";
import type { EditMessageRequest, SendMessageRequest } from "../../inpulse-types";
import type WhatsappClient from "../whatsapp-client";
import makeNewSocket from "./make-new-socket";
import BaileysStore from "./store/baileys-store";
import { ILogger } from "baileys/lib/Utils/logger";
import handleConnectionUpdate from "./handle-connection-update";
import BaileysAuth from "./auth/baileys-auth";

interface BuildBaileysWhatsappClientParams {
  sessionId: string;
  clientId: number;
  instance: string;
  eventEmitter: WppEventEmitter;
  store: BaileysStore;
  auth: BaileysAuth;
  logger: ILogger;
}
interface BaileysWhatsappClientParams {
  sessionId: string;
  clientId: number;
  instance: string;
  _sock: ReturnType<typeof makeWASocket>;
  _ev: WppEventEmitter;
  _logger: ILogger;
  _store: BaileysStore;
  _auth: BaileysAuth;
}
class BaileysWhatsappClient implements WhatsappClient {

  readonly instance: string;
  readonly clientId: number;
  readonly sessionId: string;
  _sock: ReturnType<typeof makeWASocket>;
  _logger: ILogger;
  _store: BaileysStore;
  _auth: BaileysAuth;
  _ev: WppEventEmitter;
  phone: string = "";
  reconnectAttempts: number = 0;
  lastReconnectTime: number = 0;


  constructor(props: BaileysWhatsappClientParams) {
    this.clientId = props.clientId;
    this.instance = props.instance;
    this.sessionId = props.sessionId;
    this._auth = props._auth;
    this._logger = props._logger;
    this._store = props._store;
    this._sock = props._sock;
    this._ev = props._ev;

    this._logger.info(`BaileysWhatsappClient initialized with sessionId: ${props.sessionId}, clientId: ${props.clientId}, instance: ${props.instance}`);

    new Promise(async (res) => {
      this._logger.debug(await this._store.getChats(), `Store loaded chats`);
      this._logger.debug(await this._store.getGroups(), `Store loaded groups`);
      this._logger.debug(await this._store.getContacts(), `Store loaded contacts`);
      this._logger.debug(await this._store.getMessages(), `Store loaded messages`);

      res(true);
    });

    this.bindEvents();
  }

  public bindEvents() {
    this._sock.ev.on("connection.update", (update) => handleConnectionUpdate(update, this));
  }

  public static async build(props: BuildBaileysWhatsappClientParams): Promise<BaileysWhatsappClient> {
    const socket = await makeNewSocket({
      auth: props.auth,
      store: props.store,
      logger: props.logger
    });

    const client = new BaileysWhatsappClient({
      _sock: socket,
      sessionId: props.sessionId,
      clientId: props.clientId,
      instance: props.instance,
      _ev: props.eventEmitter,
      _logger: props.logger,
      _store: props.store,
      _auth: props.auth
    });

    return client;
  }

  public isValidWhatsapp(_phone: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  public async sendMessage(_props: SendMessageRequest, _isGroup: boolean = false): Promise<InpulseMessage> {
    throw new Error("Method not implemented.");
  }

  public async editMessage(_props: EditMessageRequest): Promise<InpulseMessage> {
    throw new Error("Method not implemented.");
  }

  public async getAvatarUrl(_phone: string): Promise<string | null> {
    throw new Error("Method not implemented.");
  }

  public async getGroups(): Promise<Array<{ id: string; name: string }>> {
    throw new Error("Method not implemented.");
  }

  public resetConnAttempts() {
    this.reconnectAttempts = 0;
    this.lastReconnectTime = 0;
    this._logger.info("Reconnection attempts reset");
  }



}

export default BaileysWhatsappClient;
