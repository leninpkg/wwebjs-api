import { BackoffStrategy } from "./strategies/backoff/backoff.strategy";
import MessageProcessingQueue from "./queue";
import type { IQueueLogger, IMessageHandler, IMessageProcessingQueueBuilder } from "./contracts";
import type { MessageProcessingQueueOptions } from "./types";

/**
 * Builder para MessageProcessingQueue
 * Implementa padrão Builder com SOLID principles:
 * - Dependency Inversion: Usa interfaces (IQueueLogger, IMessageHandler, BackoffStrategy)
 * - Single Responsibility: Responsável apenas por construir a queue
 * - Interface Segregation: Interfaces pequenas e específicas
 * - Open/Closed: Extensível sem modificar o código existente
 * 
 * IMPORTANTE: Não tem dependência direta de nenhuma implementação concreta.
 * O builder trabalha apenas com abstrações (interfaces).
 * Se você deletar IncreasingBackoff, o builder continuará funcionando perfeitamente.
 */
class MessageProcessingQueueBuilder implements IMessageProcessingQueueBuilder {
  private _sessionId: string | null = null;
  private _logger: IQueueLogger | null = null;
  private _receiveHandler: IMessageHandler | null = null;
  private _editHandler: IMessageHandler | null = null;
  private _pollIntervalMs: number = 1000;
  private _maxAttempts: number = 5;
  private _maxConcurrency: number = 1;
  private _backoffStrategy: BackoffStrategy | null = null;

  /**
   * Define o ID da sessão
   */
  public withSessionId(sessionId: string): IMessageProcessingQueueBuilder {
    this._sessionId = sessionId;
    return this;
  }

  /**
   * Define o logger
   * Usa IQueueLogger (interface) em vez de ILogger concreto
   */
  public withLogger(logger: IQueueLogger): IMessageProcessingQueueBuilder {
    this._logger = logger;
    return this;
  }

  /**
   * Define o handler para mensagens RECEIVE
   */
  public withReceiveHandler(handler: IMessageHandler): IMessageProcessingQueueBuilder {
    this._receiveHandler = handler;
    return this;
  }

  /**
   * Define o handler para mensagens EDIT
   */
  public withEditHandler(handler: IMessageHandler): IMessageProcessingQueueBuilder {
    this._editHandler = handler;
    return this;
  }

  /**
   * Define o intervalo de polling em milissegundos
   */
  public withPollInterval(intervalMs: number): IMessageProcessingQueueBuilder {
    if (intervalMs <= 0) {
      throw new Error("Poll interval must be greater than 0");
    }
    this._pollIntervalMs = intervalMs;
    return this;
  }

  /**
   * Define o máximo de tentativas antes de desistir
   */
  public withMaxAttempts(attempts: number): IMessageProcessingQueueBuilder {
    if (attempts < 1) {
      throw new Error("Max attempts must be at least 1");
    }
    this._maxAttempts = attempts;
    return this;
  }

  /**
   * Define a concorrência máxima de processamento
   */
  public withConcurrency(maxConcurrent: number): IMessageProcessingQueueBuilder {
    if (maxConcurrent < 1) {
      throw new Error("Concurrency must be at least 1");
    }
    this._maxConcurrency = maxConcurrent;
    return this;
  }

  /**
   * Define a estratégia de backoff
   * Aceita qualquer implementação de BackoffStrategy (Liskov Substitution)
   */
  public withBackoffStrategy(strategy: BackoffStrategy): IMessageProcessingQueueBuilder {
    this._backoffStrategy = strategy;
    return this;
  }

  /**
   * Valida se todos os campos obrigatórios foram preenchidos
   * Implementa validação antes de construir
   */
  public validate(): void {
    if (!this._sessionId) {
      throw new Error("sessionId is required");
    }
    if (!this._logger) {
      throw new Error("logger is required");
    }
    if (!this._receiveHandler) {
      throw new Error("receiveHandler is required");
    }
    if (!this._editHandler) {
      throw new Error("editHandler is required");
    }
    if (!this._backoffStrategy) {
      throw new Error("backoffStrategy is required - use withBackoffStrategy()");
    }
  }

  /**
   * Constrói a MessageProcessingQueue com as configurações definidas
   */
  public build(): MessageProcessingQueue {
    this.validate();

    // Converte IQueueLogger em função de logger esperada pela queue
    const queueOptions: MessageProcessingQueueOptions = {
      sessionId: this._sessionId!,
      logger: {
        error: (error: unknown, msg: string) => this._logger!.error(error, msg),
        warn: (error: unknown, msg: string) => this._logger!.warn(error, msg),
        info: (msg: string) => this._logger!.info(msg),
      },
      processReceive: (messageId: string) => this._receiveHandler!.handle(messageId),
      processEdit: (messageId: string) => this._editHandler!.handle(messageId),
      backoffStrategy: this._backoffStrategy!,
      pollIntervalMs: this._pollIntervalMs,
      maxAttempts: this._maxAttempts,
      maxConcurrency: this._maxConcurrency,
    };

    return new MessageProcessingQueue(queueOptions);
  }
}

/**
 * Factory function para criar um novo builder
 * Permite criar builders com sintaxe fluente
 */
export function createQueueBuilder(): IMessageProcessingQueueBuilder {
  return new MessageProcessingQueueBuilder();
}

export { MessageProcessingQueueBuilder };
