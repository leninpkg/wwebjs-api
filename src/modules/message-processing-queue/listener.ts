import { EventEmitter } from "events";
import MessageProcessingQueue from "./queue";
import type { MessageProcessingQueueOptions } from "./types";

export interface MessageProcessingStoreEvents {
  "queue-started": [sessionId: string];
  "queue-stopped": [sessionId: string];
  "job-enqueued": [sessionId: string, messageId: string, type: "RECEIVE" | "EDIT"];
  "job-processing": [sessionId: string, messageId: string, type: "RECEIVE" | "EDIT"];
  "job-success": [sessionId: string, messageId: string, type: "RECEIVE" | "EDIT"];
  "job-failed": [sessionId: string, messageId: string, type: "RECEIVE" | "EDIT", error: Error];
  "job-retry": [sessionId: string, messageId: string, type: "RECEIVE" | "EDIT", attempt: number];
}

/**
 * Listener de eventos da fila de processamento
 * Permite que outras partes da aplicação se inscrevam em eventos da fila
 */
export class MessageProcessingQueueListener extends EventEmitter {
  private queue: MessageProcessingQueue | null = null;

  setQueue(queue: MessageProcessingQueue): void {
    this.queue = queue;
    this.emit("queue-started", (queue as any).sessionId);
  }

  getQueue(): MessageProcessingQueue | null {
    return this.queue;
  }

  override on<E extends keyof MessageProcessingStoreEvents>(
    event: E,
    listener: (...args: MessageProcessingStoreEvents[E]) => void
  ): this {
    return super.on(event, listener);
  }

  override once<E extends keyof MessageProcessingStoreEvents>(
    event: E,
    listener: (...args: MessageProcessingStoreEvents[E]) => void
  ): this {
    return super.once(event, listener);
  }

  override emit<E extends keyof MessageProcessingStoreEvents>(
    event: E,
    ...args: MessageProcessingStoreEvents[E]
  ): boolean {
    return super.emit(event, ...args);
  }
}

/**
 * Factory para criar um listener com a fila
 */
export function createMessageProcessingQueueListener(
  queueOptions: MessageProcessingQueueOptions
): { queue: MessageProcessingQueue; listener: MessageProcessingQueueListener } {
  const queue = new MessageProcessingQueue(queueOptions);
  const listener = new MessageProcessingQueueListener();
  listener.setQueue(queue);
  return { queue, listener };
}

