import { ILogger } from "baileys/lib/Utils/logger";
import DataClient from "../../../data/data-client";
import makeWASocket, { Browsers } from "baileys";

const BAILEYS_LOGS_LEVEL = process.env["BAILEYS_LOGS_LEVEL"] || "warn";

async function makeNewSocket(id: string, storage: DataClient) {
  const logger: ILogger = {
    level: "info",
    error: (msg) => {
      if (["error", "warn", "info", "debug", "trace"].includes(BAILEYS_LOGS_LEVEL)) {
        console.log(`[ERROR]`, msg);
      }
    },
    warn: (msg) => {
      if (["warn", "info", "debug", "trace"].includes(BAILEYS_LOGS_LEVEL)) {
        console.log(`[WARN]`, msg);
      }
    },
    info: (msg) => {
      if (["info", "debug", "trace"].includes(BAILEYS_LOGS_LEVEL)) {
        console.log(`[INFO]`, msg);
      }
    },
    child: (msg) => {
      console.log(`[CHILD LOGGER]`, msg);
      return logger;
    },
    debug: () => { },
    trace: () => { },
  };

  const authState = await storage.getAuthState(id);
  const signalStore = await storage.getSignalKeyStore(id);
  const socket = makeWASocket({
    logger,
    auth: {
      creds: authState.creds,
      keys: signalStore,
    },
    browser: Browsers.windows("Google Chrome"),
    cachedGroupMetadata: async (jid) => storage.getGroupMetadata(id, jid),
    getMessage: async (key) => storage.getRawMessage(id, key),
    syncFullHistory: process.env["BAILEYS_SYNC_FULL_HISTORY"] !== "false",
  });

  return socket;
}

export default makeNewSocket;
