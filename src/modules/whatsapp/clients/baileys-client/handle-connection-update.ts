import { Boom } from '@hapi/boom';
import { ConnectionState, DisconnectReason } from "baileys";
import { sleep } from "../../../../helpers/humanize.utils";
import makeNewSocket from "./make-new-socket";
import BaileysWhatsappClient from './baileys-whatsapp-client';



/**
 * Calcula o delay de reconexão usando backoff exponencial
 * Tentativas: 1=5s, 2=15s, 3=30s, 4+=60s, 5=120s, 6=240s
 */
function calculateReconnectDelay(attempts: number): number {
  const delays = [5000, 15000, 30000, 60000, 120000, 240000]; // ms
  return delays[Math.min(attempts, delays.length - 1)] || 4800000;
}

async function handleConnectionUpdate(update: Partial<ConnectionState>, client: BaileysWhatsappClient) {
  client._logger.debug(update, "(handleConnectionUpdate) Connection update received");

  if (update.qr) {
    client._ev.emit({
      type: "qr-received",
      clientId: client.clientId,
      qr: update.qr,
    });

    client._logger.info("(handleConnectionUpdate) QR code generated for connection");
  }

  if (update.connection === "open") {
    const phone = client._sock.user?.id || "unknown";

    client._logger.info(`(handleConnectionUpdate) Connection opened successfully! phone: ${phone}`);
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

  if (update.connection === "close" && isRestartRequired) {
    client._logger.warn(`(handleConnectionUpdate) Connection closed with restart required. Status code: ${errStatusCode}`);

    const delay = calculateReconnectDelay(client.reconnectAttempts);
    client._logger.info(`(handleConnectionUpdate) Socket restart required. Tentativa ${client.reconnectAttempts + 1}, aguardando ${delay}ms antes de reconectar...`);

    await sleep(delay);

    client.reconnectAttempts++;
    client.lastReconnectTime = Date.now();

    client._logger.info("(handleConnectionUpdate) Reinicializando socket...");
    client.unbindEvents();
    client._sock = await makeNewSocket({ auth: client._auth, store: client._store, logger: client._logger });
    client.bindEvents();
    client._logger.info("(handleConnectionUpdate) Socket reinicializado com sucesso");
  }
  if (update.connection === "close" && !isRestartRequired) {
    client._auth.removeCredentials();
    client._logger.info("(handleConnectionUpdate) Logged out, cleared auth state from storage");

    const delay = 5000;
    client._logger.info(`(handleConnectionUpdate) Aguardando ${delay}ms antes de reinicializar após logout...`);
    await sleep(delay);

    client.unbindEvents();
    client._sock = await makeNewSocket({ auth: client._auth, store: client._store, logger: client._logger });
    client.bindEvents();
    client._logger.info("(handleConnectionUpdate) Socket reinicializado após logout");
  }
}

export default handleConnectionUpdate;
