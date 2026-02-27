import "dotenv/config";

import makeWASocket, { Browsers, fetchLatestBaileysVersion, isJidBroadcast, isJidMetaAI, isJidNewsletter, isJidStatusBroadcast, makeCacheableSignalKeyStore } from "baileys";
import DataClient from "../../../data/data-client";
import logger from "./logger";

async function makeNewSocket(id: string, storage: DataClient) {
  const authState = await storage.getAuthState(id);
  const signalStore = await storage.getSignalKeyStore(id);
  const syncFullHistory = process.env["BAILEYS_SYNC_FULL_HISTORY"] !== "false";

  console.log(`Criando nova instância de socket para o cliente ${id}... syncFullHistory=${syncFullHistory}`);

  const { version } = await fetchLatestBaileysVersion();

  const socket = makeWASocket({
    logger,
    auth: {
      creds: authState.creds,
      keys: makeCacheableSignalKeyStore(signalStore, logger),
    },
    browser: Browsers.windows("Google Chrome"),
    cachedGroupMetadata: async (jid) => storage.getGroupMetadata(id, jid),
    getMessage: async (key) => storage.getRawMessage(id, key),
    shouldIgnoreJid: jid => {
      try {
        if (isJidBroadcast(jid)) return true;
        if (isJidStatusBroadcast(jid)) return true;
        if (isJidMetaAI(jid)) return true;
        if (isJidNewsletter(jid)) return true;
        return false;
      } catch {
        return false;
      }
    },
    syncFullHistory,
    enableAutoSessionRecreation: true,
    version
  });

  return socket;
}

export default makeNewSocket;
