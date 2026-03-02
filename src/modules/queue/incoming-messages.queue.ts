import { Queue, RepeatStrategy } from "bullmq";
import { REDIS_HOST, REDIS_PORT } from "../../redis";

export interface IncomingMessageJobData {
  instance: string;
  clientId: number;
  messageId: string;
}

export enum IncomingMessageEvent {
  RECEIVED,
  EDITED,
  STATUS_UPDATED,
  REVOKED
}

const retryDelayStrategy: RepeatStrategy = (attemptsMade) => {
  const delays = [
    5 * 1000,              // 1º retry:  5 segundos
    30 * 1000,             // 2º retry: 30 segundos
    1 * 60 * 1000,         // 3º retry:  1 minuto
    10 * 60 * 1000,        // 4º retry: 10 minutos
    30 * 60 * 1000,        // 5º retry: 30 minutos
    2 * 60 * 60 * 1000,    // 6º retry:  2 horas
    21.5 * 60 * 60 * 1000, // 7º retry: 21 horas 30 minutos
    24 * 60 * 60 * 1000,   // 8º retry: 24 horas
    24 * 60 * 60 * 1000,   // 9º retry: 24 horas
  ];

  return delays[attemptsMade] || -1; // -1 para parar após a última tentativa
};

const incomingMessagesQueue = new Queue("incoming-messages", {
  connection: {
    host: REDIS_HOST,
    port: REDIS_PORT
  },
  settings: {
    repeatStrategy: retryDelayStrategy
  }
});

export default incomingMessagesQueue;