import makeWASocket, { Browsers, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } from "baileys";
import BaileysAuth from "./auth/baileys-auth";
import BaileysStore from "./store/baileys-store";
import { ILogger } from "baileys/lib/Utils/logger";

interface MakeNewSocketParams {
  auth: BaileysAuth;
  store: BaileysStore;
  logger: ILogger;
}

async function makeNewSocket({ store, logger, auth }: MakeNewSocketParams) {
  const { version, error } = await fetchLatestBaileysVersion();

  if (error) {
    logger.error(error, "Failed to fetch latest Baileys version, using default");
  }

  const socket = makeWASocket({
    logger,
    auth: {
      creds: auth.creds,
      keys: makeCacheableSignalKeyStore(auth.state.keys, logger),
    },
    browser: Browsers.windows("Google Chrome"),
    cachedGroupMetadata: async (jid) => (await store.getGroup(jid))?.groupMetadata,
    getMessage: async (key) => (await store.getMessage(key.id!)).messageData,
    enableAutoSessionRecreation: true,
    ...(version ? { version } : {}),
  });

  store.bind(socket.ev);

  return socket;
}

export default makeNewSocket;
