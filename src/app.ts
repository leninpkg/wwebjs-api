import "dotenv/config";
import ExpressApi from "./api";
import HttpWppEventEmitter from "./modules/events/emitter/http-emitter";
import BaileysWhatsappClient from "./modules/whatsapp/clients/baileys-client/baileys-whatsapp-client";
import PrismaBaileysStore from "./modules/whatsapp/clients/baileys-client/store/prisma-baileys-store/prisma-baileys-store";
import { PrismaLogger } from "./modules/whatsapp/clients/baileys-client/logger/prisma-logger";
import PrismaBaileysAuth from "./modules/whatsapp/clients/baileys-client/auth/prisma-baileys-auth";

// Handlers globais para erros não capturados
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
  const instance = process.env["INSTANCE_NAME"];
  const clientId = process.env["CLIENT_ID"] ? parseInt(process.env["CLIENT_ID"], 10) : null;
  const sessionId =
    process.env["SESSION_ID"] || (instance && clientId !== null ? `${instance}-${clientId}` : null);
  const listenPort = parseInt(process.env["API_LISTEN_PORT"] || "727", 10);

  console.log("Starting application with the following configuration:");
  console.log(`WPP_EVENT_ENDPOINTS: ${endpoints}`);
  console.log(`INSTANCE_NAME: ${instance}`);
  console.log(`CLIENT_ID: ${clientId}`);
  console.log(`SESSION_ID: ${sessionId}`);
  console.log(`API_LISTEN_PORT: ${listenPort}`);

  if (!endpoints || endpoints.length === 0) {
    throw new Error("WPP_EVENT_ENDPOINTS environment variable is not set or empty");
  }

  if (!instance) {
    throw new Error("INSTANCE_NAME environment variable is not set");
  }

  if (clientId === null || isNaN(clientId)) {
    throw new Error("CLIENT_ID environment variable is not set or invalid");
  }

  if (!sessionId) {
    throw new Error("SESSION_ID environment variable is not set and cannot be derived");
  }

  const eventEmitter = new HttpWppEventEmitter(endpoints);
  const store = new PrismaBaileysStore(instance, sessionId, clientId,);
  const logger = new PrismaLogger("info", { sessionId, instance });
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

  const api = ExpressApi.create(wppClient);
  api.listen(listenPort);
}

runApp().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
