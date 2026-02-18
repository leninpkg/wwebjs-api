import { ConnectionState, DisconnectReason } from "baileys";
import ProcessingLogger from "../../../../helpers/processing-logger";
import { sleep } from "../../../../helpers/humanize.utils";
import BaileysWhatsappClient from "./baileys-whatsapp-client";
import makeNewSocket from "./make-new-socket";

interface ConnectionUpdateContext {
  update: Partial<ConnectionState>;
  client: BaileysWhatsappClient;
  logger: ProcessingLogger;
}

/**
 * Calcula o delay de reconexão usando backoff exponencial
 * Tentativas: 1=5s, 2=15s, 3=30s, 4+=60s, 5=120s, 6=240s
 */
function calculateReconnectDelay(attempts: number): number {
  const delays = [5000, 15000, 30000, 60000, 120000, 240000]; // ms
  return delays[Math.min(attempts, delays.length - 1)] || 4800000;
}

/**
 * Verifica se já passou tempo suficiente desde a última reconexão
 * Reseta contador se passou mais de 5 minutos
 */
function shouldResetAttempts(lastReconnectTime: number): boolean {
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() - lastReconnectTime > fiveMinutes;
}

async function handleConnectionUpdate({ update, client, logger }: ConnectionUpdateContext) {
  logger.log("Connection update received", update);

  if (update.qr) {
    client._ev.emit({
      type: "qr-received",
      clientId: client.clientId,
      qr: update.qr,
    });

    logger.log("QR code generated for connection");
  }

  if (update.connection === "open") {
    logger.log("Connection opened successfully");

    // Resetar contador de reconexão em caso de sucesso
    client._reconnectAttempts = 0;
    client._lastReconnectTime = 0;
    logger.log("Contador de reconexão resetado após conexão bem-sucedida");

    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const sevenDaysAgo = new Date(Date.now() - sevenDays);
    client._sock.fetchMessageHistory(10, {}, sevenDaysAgo.getTime());
    client._phone = client._sock.user?.id.split(":")[0] || "";

    client._ev.emit({
      type: "auth-success",
      clientId: client.clientId,
      phoneNumber: client._phone,
    });
  }

  const errStatusCode = (update.lastDisconnect?.error as any)?.output?.statusCode;
  const isRestartRequired = errStatusCode === DisconnectReason.restartRequired;

  if (update.connection === "close" && isRestartRequired) {
    // Resetar contador se passou tempo suficiente
    if (shouldResetAttempts(client._lastReconnectTime)) {
      client._reconnectAttempts = 0;
      logger.log("Reset de contador de reconexão (passou tempo suficiente)");
    }

    // Calcular delay com backoff exponencial
    const delay = calculateReconnectDelay(client._reconnectAttempts);
    logger.log(`Socket restart required. Tentativa ${client._reconnectAttempts + 1}, aguardando ${delay}ms antes de reconectar...`);

    await sleep(delay);

    client._reconnectAttempts++;
    client._lastReconnectTime = Date.now();

    logger.log("Reinicializando socket...");
    client._sock = await makeNewSocket(client.sessionId, client._storage);
    client.bindEvents();
    logger.log("Socket reinicializado com sucesso");
  }
  if (update.connection === "close" && !isRestartRequired) {
    client._storage.clearAuthState(client.sessionId);
    logger.log("Logged out, cleared auth state from storage");

    // Aplicar delay também no logout para evitar reconexão agressiva
    const delay = 5000;
    logger.log(`Aguardando ${delay}ms antes de reinicializar após logout...`);
    await sleep(delay);

    client._sock = await makeNewSocket(client.sessionId, client._storage);
    client.bindEvents();
    logger.log("Socket reinitialized after logout");
  }
}

export default handleConnectionUpdate;
