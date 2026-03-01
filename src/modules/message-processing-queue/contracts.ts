/**
 * Interface para logger da fila de processamento
 * Implementa Dependency Inversion - não depende de implementação concreta
 */
export interface IQueueLogger {
  error(error: unknown, message: string): void;
  warn(error: unknown, message: string): void;
  info(message: string): void;
}

/**
 * Interface para handler de processamento de mensagens
 * Implementa Interface Segregation - responsabilidade única e clara
 */
export interface IMessageHandler {
  handle(messageId: string): Promise<void>;
}

/**
 * Interface para o Builder da Queue
 * Define o contrato do builder para permitir extensão
 */
export interface IMessageProcessingQueueBuilder {
  withSessionId(sessionId: string): IMessageProcessingQueueBuilder;
  withLogger(logger: IQueueLogger): IMessageProcessingQueueBuilder;
  withReceiveHandler(handler: IMessageHandler): IMessageProcessingQueueBuilder;
  withEditHandler(handler: IMessageHandler): IMessageProcessingQueueBuilder;
  withPollInterval(intervalMs: number): IMessageProcessingQueueBuilder;
  withMaxAttempts(attempts: number): IMessageProcessingQueueBuilder;
  withConcurrency(maxConcurrent: number): IMessageProcessingQueueBuilder;
  withBackoffStrategy(strategy: any): IMessageProcessingQueueBuilder;
  build(): any;
  validate(): void;
}
