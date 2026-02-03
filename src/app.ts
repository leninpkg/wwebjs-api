import ExpressApi from "./api";
import MySQLDataClient from "./modules/data/mysql-data-client";
import HttpWppEventEmitter from "./modules/events/emitter/http-emitter";
import BaileysWhatsappClient from "./modules/whatsapp/clients/baileys-client/baileys-whatsapp-client";
import { config } from "dotenv";

// Handlers globais para erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Não fazer exit aqui para manter o servidor rodando
});

async function runApp() {
  config();

  const endpoints = process.env["WPP_EVENT_ENDPOINTS"]?.split(",");
  const mysqlHost = process.env["MYSQL_HOST"] || "localhost";
  const mysqlPort = parseInt(process.env["MYSQL_PORT"] || "3306", 10);
  const mysqlUser = process.env["MYSQL_USER"];
  const mysqlPassword = process.env["MYSQL_PASSWORD"];
  const mysqlDatabase = process.env["MYSQL_DATABASE"] || "wwebjs-api";
  const instanceName = process.env["INSTANCE_NAME"];
  const clientId = process.env["CLIENT_ID"] ? parseInt(process.env["CLIENT_ID"], 10) : null;
  const sessionId =
    process.env["SESSION_ID"] || (instanceName && clientId !== null ? `${instanceName}-${clientId}` : null);
  const listenPort = parseInt(process.env["API_LISTEN_PORT"] || "727", 10);

  if (!mysqlUser || !mysqlPassword) {
    throw new Error("MYSQL_USER or MYSQL_PASSWORD environment variable is not set");
  }

  if (!endpoints || endpoints.length === 0) {
    throw new Error("WPP_EVENT_ENDPOINTS environment variable is not set or empty");
  }

  if (!instanceName) {
    throw new Error("INSTANCE_NAME environment variable is not set");
  }

  if (clientId === null || isNaN(clientId)) {
    throw new Error("CLIENT_ID environment variable is not set or invalid");
  }

  if (!sessionId) {
    throw new Error("SESSION_ID environment variable is not set and cannot be derived");
  }

  const eventEmitter = new HttpWppEventEmitter(endpoints);
  const dbClient = new MySQLDataClient(mysqlHost, mysqlPort, mysqlUser, mysqlPassword, mysqlDatabase);
  const wppClient = await BaileysWhatsappClient.build(sessionId, clientId, instanceName, dbClient, eventEmitter);
  const api = ExpressApi.create(wppClient);
  api.listen(listenPort);
}

runApp().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
