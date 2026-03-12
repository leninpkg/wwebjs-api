import { ConnectionState, DisconnectReason } from "baileys";
import ProcessingLogger from "../../../../utils/processing-logger";
import { sleep } from "../../../../utils/humanize.utils";
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
  const isLoggedOut = errStatusCode === DisconnectReason.loggedOut;

  if (update.connection === "close") {
    logger.log(`Connection closed. Status code: ${errStatusCode}, Reason: ${isRestartRequired ? 'restart required' : isLoggedOut ? 'logged out / device removed' : 'unknown'}`);

    if (isRestartRequired) {
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
    } else if (isLoggedOut) {
      // Device removed / logged out - precisa limpar estado e gerar novo QR
      logger.log("Device removed or logged out detected. Clearing auth state...");
      
      await client._storage.clearAuthState(client.sessionId);
      logger.log("Auth state cleared successfully");

      // Emitir evento de logout
/*       client._ev.emit({
        type: "auth-logout",
        clientId: client.clientId,
        reason: "device_removed",
      }); */

      // Resetar contadores
      client._reconnectAttempts = 0;
      client._lastReconnectTime = 0;

      // Aguardar um pouco antes de reinicializar
      const delay = 3000;
      logger.log(`Aguardando ${delay}ms antes de reinicializar e gerar novo QR code...`);
      await sleep(delay);

      logger.log("Reinicializando socket para gerar novo QR code...");
      client._sock = await makeNewSocket(client.sessionId, client._storage);
      client.bindEvents();
      logger.log("Socket reinicializado - aguardando geração de QR code");
    } else {
      // Outros tipos de desconexão
      logger.log(`Unhandled disconnection. Status code: ${errStatusCode}. Preserving auth state and retrying reconnect...`);

      const delay = 5000;
      logger.log(`Aguardando ${delay}ms antes de reinicializar...`);
      await sleep(delay);

      client._sock = await makeNewSocket(client.sessionId, client._storage);
      client.bindEvents();
      logger.log("Socket reinitialized after unknown disconnection");
    }
  }
}

export default handleConnectionUpdate;
