import { Boom } from '@hapi/boom';
import { ConnectionState, DisconnectReason } from "baileys";
import { sleep } from "../../../../../helpers/humanize.utils";
import createBaileysSocket from "../create-baileys-socket";
import BaileysWhatsappClient from '../baileys-whatsapp-client';



/**
 * Calcula o delay de reconexão usando backoff exponencial
 * Tentativas: 1=5s, 2=15s, 3=30s, 4+=60s, 5=120s, 6=240s
 */
function calculateReconnectDelay(attempts: number): number {
  const delays = [1000, 5000, 10000, 30000, 60000, 120000]; // ms
  return delays[Math.min(attempts, delays.length - 1)] || 4800000;
}

async function handleConnectionUpdate(update: Partial<ConnectionState>, client: BaileysWhatsappClient) {
  const logger = client.getCorrelatedLog("hConnUpdate");
  logger.debug(update, "Connection update received");

  if (update.qr) {
    client._ev.emit({
      type: "qr-received",
      clientId: client.clientId,
      qr: update.qr,
    });

    logger.info("QR code generated for connection");
  }

  if (update.connection === "open") {
    const phone = client._sock.user?.id || "unknown";

    logger.info(`Connection opened successfully! phone: ${phone}`);
    client.resetConnAttempts();
    client.phone = phone;

    client._ev.emit({
      type: "auth-success",
      clientId: client.clientId,
      phoneNumber: client.phone,
    });
  }

  const errStatusCode = (update.lastDisconnect?.error as Boom)?.output?.statusCode;
  const isRestartRequired = errStatusCode === DisconnectReason.restartRequired;
  const isLoggedOut = errStatusCode === DisconnectReason.loggedOut;

  if (update.connection === "close" && isRestartRequired) {
    if (!client.startSocketReinitialization()) {
      logger.warn("Reinitialization already in progress, ignoring duplicate close event");
      return;
    }

    logger.warn(`Connection closed with restart required. Status code: ${errStatusCode}`);

    try {
      const delay = calculateReconnectDelay(client.reconnectAttempts);
      logger.info(`Socket restart required. Tentativa ${client.reconnectAttempts + 1}, aguardando ${delay}ms antes de reconectar...`);

      await sleep(delay);

      client.reconnectAttempts++;
      client.lastReconnectTime = Date.now();

      logger.info("Reinicializando socket...");
      client.unbindEvents();
      client._sock = await createBaileysSocket({ auth: client._auth, store: client._store, logger: client._logger });
      client.bindEvents();
      logger.info("Socket reinicializado com sucesso");
    } finally {
      client.finishSocketReinitialization();
    }

    return;
  }

  if (update.connection === "close" && isLoggedOut) {
    if (!client.startSocketReinitialization()) {
      logger.warn("Reinitialization already in progress, ignoring duplicate close event");
      return;
    }

    try {
      await client._auth.removeCredentials();
      logger.info("Logged out detected, cleared auth state from storage");

      client.unbindEvents();
      client._sock.end(new Boom("Logged out", { statusCode: DisconnectReason.loggedOut }));

      client.phone = "";
      client.resetConnAttempts();

      client._sock = await createBaileysSocket({ auth: client._auth, store: client._store, logger: client._logger });
      client.bindEvents();
      logger.info("Socket restarted after logout and is ready for new authentication");
    } finally {
      client.finishSocketReinitialization();
    }

    return;
  }

  if (update.connection === "close" && !isRestartRequired) {
    if (!client.startSocketReinitialization()) {
      logger.warn("Reinitialization already in progress, ignoring duplicate close event");
      return;
    }

    try {
      const delay = 5000;
      logger.info(`Aguardando ${delay}ms antes de reinicializar após desconexão...`);
      await sleep(delay);

      client.unbindEvents();
      client._sock = await createBaileysSocket({ auth: client._auth, store: client._store, logger: client._logger });
      client.bindEvents();
      logger.info("Socket reinicializado após desconexão");
    } finally {
      client.finishSocketReinitialization();
    }
  }
}

export default handleConnectionUpdate;
