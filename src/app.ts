import "dotenv/config";
import ExpressApi from "./api";
import HttpWppEventEmitter from "./modules/events/emitter/http-emitter";
import messageReceive from "./modules/inpulse/message-receive";
import BaileysMessageAdapter from "./modules/whatsapp/clients/baileys-client/adapters/baileys-message-adapter";
import PrismaBaileysAuth from "./modules/whatsapp/clients/baileys-client/auth/prisma-baileys-auth";
import BaileysWhatsappClient from "./modules/whatsapp/clients/baileys-client/baileys-whatsapp-client";
import { PrismaLogger } from "./modules/whatsapp/clients/baileys-client/logger/prisma-logger";
import PrismaBaileysStore from "./modules/whatsapp/clients/baileys-client/store/prisma-baileys-store/prisma-baileys-store";

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack:', error.stack);
});

async function runApp() {
  const endpoints = process.env["WPP_EVENT_ENDPOINTS"]?.split(",");
  const instance = process.env["CLIENT_INSTANCE"];
  const clientId = process.env["CLIENT_ID"] ? parseInt(process.env["CLIENT_ID"], 10) : null;
  const sessionId =
    process.env["CLIENT_SESSION_ID"] || (instance && clientId !== null ? `${instance}-${clientId}` : null);
  const listenPort = parseInt(process.env["API_PORT"] || "727", 10);

  console.log("Starting application with the following configuration:");
  console.log(`WPP_EVENT_ENDPOINTS: ${endpoints}`);
  console.log(`CLIENT_ID: ${clientId}`);
  console.log(`CLIENT_INSTANCE: ${instance}`);
  console.log(`CLIENT_SESSION_ID: ${sessionId}`);
  console.log(`API_PORT: ${listenPort}`);

  if (!endpoints || endpoints.length === 0) {
    throw new Error("WPP_EVENT_ENDPOINTS environment variable is not set or empty");
  }

  if (!instance) {
    throw new Error("CLIENT_INSTANCE environment variable is not set");
  }

  if (clientId === null || isNaN(clientId)) {
    throw new Error("CLIENT_ID environment variable is not set or invalid");
  }

  if (!sessionId) {
    throw new Error("CLIENT_SESSION_ID environment variable is not set and cannot be derived");
  }

  const eventEmitter = new HttpWppEventEmitter(endpoints);
  const logger = new PrismaLogger("info", { sessionId, instance }, "WppClient");
  const store = new PrismaBaileysStore(instance, sessionId, logger);
  const auth = await PrismaBaileysAuth.fromSession(sessionId);
  const wppClient = await BaileysWhatsappClient.build({
    auth,
    store,
    eventEmitter,
    instance,
    clientId,
    sessionId,
    logger
  });

  store.on("message-upsert", async (event) => {
    const message = new BaileysMessageAdapter(event.message);
    const inpulseMsg = await message.toInpulseMessage({ clientId, clientPhone: wppClient.phone, instance, store });
    await messageReceive({
      emitter: eventEmitter,
      messageId: event.messageId,
      message: inpulseMsg,
      logger,
    })
  });

  const api = new ExpressApi(wppClient, logger);
  api.listen(listenPort);
}

runApp().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
