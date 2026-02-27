import makeWASocket, { Browsers, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } from "baileys";
import BaileysAuth from "./auth/baileys-auth";
import { PrismaLogger } from "./logger/prisma-logger";
import BaileysStore from "./store/baileys-store";

interface CreateBaileysSocketParams {
  auth: BaileysAuth;
  store: BaileysStore;
  logger: PrismaLogger;
}

async function createBaileysSocket({ store, logger, auth }: CreateBaileysSocketParams) {

  const { version, error } = await fetchLatestBaileysVersion();

  if (error) {
    logger.error(error, "Failed to fetch latest Baileys version, using default");
  }

  const socketLogger = logger.getCorrelatedLogger("WppSocket", "");

  const socket = makeWASocket({
    logger: socketLogger,
    auth: {
      creds: auth.creds,
      keys: makeCacheableSignalKeyStore(auth.state.keys, socketLogger),
    },
    browser: Browsers.windows("Google Chrome"),
    cachedGroupMetadata: async (jid) => (await store.getGroup(jid))?.groupMetadata,
    getMessage: async (key) => (await store.getMessage(key.id!))?.messageData,
    enableAutoSessionRecreation: true,
    ...(version ? { version } : {}),
  });

  return socket;
}

export default createBaileysSocket;
