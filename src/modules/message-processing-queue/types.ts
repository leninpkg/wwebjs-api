import { MessageProcessingState, MessageProcessingType } from "../../generated/prisma/enums";
import type { BackoffStrategy } from "./strategies/backoff/backoff.strategy";

/**
 * Opções de configuração para a fila de processamento de mensagens
 */
export interface MessageProcessingQueueOptions {
  /**
   * ID da sessão para filtrar jobs
   */
  sessionId: string;

  /**
   * Logger para auditoria e debugging
   */
  logger: {
    error: (error: unknown, message: string, emitter?: string, operation?: string) => void;
    warn: (error: unknown, message: string, emitter?: string, operation?: string) => void;
    info: (message: string, emitter?: string, operation?: string) => void;
  };

  /**
   * Estratégia de backoff para retentativas
   */
  backoffStrategy: BackoffStrategy;

  /**
   * Intervalo de polling em ms (padrão: 1000ms)
   */
  pollIntervalMs?: number;

  /**
   * Máximo de tentativas antes de desistir (padrão: 5)
   */
  maxAttempts?: number;

  /**
   * Concorrência máxima de processamento (padrão: 1)
   */
  maxConcurrency?: number;

  /**
   * Handler para processar mensagens RECEIVE
   */
  processReceive: (messageId: string) => Promise<void>;

  /**
   * Handler para processar mensagens EDIT
   */
  processEdit: (messageId: string) => Promise<void>;
}

/**
 * Estado de um job em processamento
 */
export interface QueueJob {
  id: string;
  messageId: string;
  processingType: MessageProcessingType;
  status: MessageProcessingState;
  attempts: number;
  nextAttemptAt: Date | null;
  processingAt: Date | null;
  processedAt: Date | null;
  lastError: string | null;
}
