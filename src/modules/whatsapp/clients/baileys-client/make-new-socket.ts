import makeWASocket, { Browsers } from "baileys";
import { BaileysLogger } from "./baileys-logger";
import PrismaBaileysAuth from "./auth/prisma-baileys-auth";

const BAILEYS_LOGS_LEVEL = process.env["BAILEYS_LOGS_LEVEL"] || "warn";

async function makeNewSocket(id: string) {
  const logger = new BaileysLogger(BAILEYS_LOGS_LEVEL);
  const authState = await storage.getAuthState(id);
  const signalStore = await storage.getSignalKeyStore(id);

  const auth = await PrismaBaileysAuth.fromSession(id);

  const socket = makeWASocket({
    logger,
    auth: {
      creds: auth.creds,
      keys: signalStore,
    },
    browser: Browsers.windows("Google Chrome"),
    cachedGroupMetadata: async (jid) => storage.getGroupMetadata(id, jid),
    getMessage: async (key) => storage.getRawMessage(id, key),
  });

  return socket;
}

export default makeNewSocket;
