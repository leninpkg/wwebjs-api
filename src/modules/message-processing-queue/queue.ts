import Bottleneck from "bottleneck";
import { MessageProcessingState, MessageProcessingType } from "../../generated/prisma/enums";
import { prisma } from "../../prisma";
import type { MessageProcessingQueueOptions } from "./types";

/**
 * Fila de processamento de mensagens com polling, retry automático e backoff
 *
 * Gerencia o processamento assíncrono de eventos de recebimento e edição de mensagens
 * com suporte a retry com backoff customizável, concorrência limitada e polling.
 */
class MessageProcessingQueue {
  private readonly sessionId: string;
  private readonly logger: MessageProcessingQueueOptions["logger"];
  private readonly backoffStrategy: MessageProcessingQueueOptions["backoffStrategy"];
  private readonly pollIntervalMs: number;
  private readonly maxAttempts: number;
  private readonly limiter: Bottleneck;
  private timer: NodeJS.Timeout | null = null;
  private isPolling = false;

  private readonly processReceive: (messageId: string) => Promise<void>;
  private readonly processEdit: (messageId: string) => Promise<void>;

  constructor(options: MessageProcessingQueueOptions) {
    this.sessionId = options.sessionId;
    this.logger = options.logger;
    this.pollIntervalMs = options.pollIntervalMs ?? 1000;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.processReceive = options.processReceive;
    this.processEdit = options.processEdit;
    this.backoffStrategy = options.backoffStrategy;
    this.limiter = new Bottleneck({ maxConcurrent: options.maxConcurrency ?? 1 });
  }

  /**
   * Inicia o polling da fila
   */
  public start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.pollAndProcess();
    }, this.pollIntervalMs);

    void this.pollAndProcess();
  }

  /**
   * Para o polling da fila
   */
  public stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Enfileira um processamento de recebimento de mensagem
   */
  public async enqueueReceive(messageId: string): Promise<void> {
    await this.enqueue(messageId, MessageProcessingType.RECEIVE);
  }

  /**
   * Enfileira um processamento de edição de mensagem
   */
  public async enqueueEdit(messageId: string): Promise<void> {
    await this.enqueue(messageId, MessageProcessingType.EDIT);
  }

  /**
   * Remove um job da fila
   */
  public async remove(messageId: string, processingType: MessageProcessingType): Promise<void> {
    await prisma.messageProcessingStatus.deleteMany({
      where: {
        messageId,
        processingType,
        sessionId: this.sessionId,
      },
    });
  }

  /**
   * Obtém o status de um job
   */
  public async getStatus(messageId: string, processingType: MessageProcessingType) {
    return await prisma.messageProcessingStatus.findUnique({
      where: {
        uq_message_processing_status_message_id_type: {
          messageId,
          processingType,
        },
      },
    });
  }

  /**
   * Enfileira um job de processamento
   */
  private async enqueue(messageId: string, processingType: MessageProcessingType): Promise<void> {
    await prisma.messageProcessingStatus.upsert({
      where: {
        uq_message_processing_status_message_id_type: {
          messageId,
          processingType,
        },
      },
      create: {
        messageId,
        sessionId: this.sessionId,
        processingType,
        status: MessageProcessingState.PENDING,
        attempts: 0,
      },
      update: {
        status: MessageProcessingState.PENDING,
        nextAttemptAt: null,
        processingAt: null,
        processedAt: null,
        lastError: null,
      },
    });
  }

  /**
   * Realiza o poll e processa jobs aguardando
   */
  private async pollAndProcess(): Promise<void> {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;

    try {
      const now = new Date();
      const jobs = await prisma.messageProcessingStatus.findMany({
        where: {
          sessionId: this.sessionId,
          OR: [
            { status: MessageProcessingState.PENDING },
            {
              status: MessageProcessingState.FAILED,
              nextAttemptAt: { lte: now },
            },
          ],
        },
        orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
        take: 20,
      });

      await Promise.all(
        jobs.map((job) => this.limiter.schedule(() => this.processJob(job.id)))
      );
    } catch (error) {
      this.logger.error(error, "Failed to poll message processing queue", "MessageQueue", "poll");
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Processa um job individual
   */
  private async processJob(jobId: string): Promise<void> {
    const now = new Date();

    const claim = await prisma.messageProcessingStatus.updateMany({
      where: {
        id: jobId,
        OR: [
          { status: MessageProcessingState.PENDING },
          {
            status: MessageProcessingState.FAILED,
            nextAttemptAt: { lte: now },
          },
        ],
      },
      data: {
        status: MessageProcessingState.PROCESSING,
        processingAt: now,
        attempts: { increment: 1 },
        lastError: null,
      },
    });

    if (claim.count === 0) {
      return;
    }

    const job = await prisma.messageProcessingStatus.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        messageId: true,
        processingType: true,
        attempts: true,
      },
    });

    if (!job) {
      return;
    }

    try {
      if (job.processingType === MessageProcessingType.RECEIVE) {
        await this.processReceive(job.messageId);
      } else if (job.processingType === MessageProcessingType.EDIT) {
        await this.processEdit(job.messageId);
      }

      await prisma.messageProcessingStatus.update({
        where: { id: job.id },
        data: {
          status: MessageProcessingState.SUCCESS,
          processedAt: new Date(),
          nextAttemptAt: null,
          processingAt: null,
          lastError: null,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? `${error.name}: ${error.message}` : String(error);

      if (job.attempts >= this.maxAttempts) {
        await prisma.messageProcessingStatus.update({
          where: { id: job.id },
          data: {
            status: MessageProcessingState.FAILED,
            processingAt: null,
            nextAttemptAt: null,
            lastError: errorMessage,
          },
        });

        this.logger.error(
          error,
          `Message processing permanently failed after ${job.attempts} attempts (messageId=${job.messageId}, type=${job.processingType})`,
          "MessageQueue",
          "processJob"
        );
        return;
      }

      await prisma.messageProcessingStatus.update({
        where: { id: job.id },
        data: {
          status: MessageProcessingState.FAILED,
          processingAt: null,
          nextAttemptAt: this.backoffStrategy.getNextAttemptAt(job.attempts),
          lastError: errorMessage,
        },
      });

      this.logger.warn(
        error,
        `Message processing failed and will be retried (attempt=${job.attempts}, messageId=${job.messageId}, type=${job.processingType})`,
        "MessageQueue",
        "processJob"
      );
    }
  }
}

export default MessageProcessingQueue;
