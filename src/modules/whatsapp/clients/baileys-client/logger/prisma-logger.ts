import { prisma } from "../../../../../prisma";
import { Prisma } from "../../../../../generated/prisma/client";
import { ConsoleLogger } from "./console-logger";

interface LogContext {
  sessionId: string;
  instance: string;
  correlationId?: string;
}

export class PrismaLogger extends ConsoleLogger {
  private static readonly FLUSH_INTERVAL_MS = 250;
  private static readonly BATCH_SIZE = 25;
  private static readonly MAX_QUEUE_SIZE = 500;

  private context: LogContext;
  private readonly pendingLogs: Array<{
    level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
    emittedBy: string;
    operationName: string | null;
    correlationId: string | null;
    message: string;
    metadata: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    sessionId: string;
    instance: string;
  }> = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private droppedLogs = 0;

  constructor(level: string, context: LogContext, defaultEmitter: string = "PrismaLogger") {
    super(level, defaultEmitter);
    this.context = context;
  }

  private normalizeMetadata(metadata?: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    if (typeof metadata === "undefined" || metadata === null) {
      return Prisma.JsonNull;
    }

    try {
      return JSON.parse(JSON.stringify(metadata));
    } catch {
      return {
        serializationError: "Failed to serialize metadata",
        metadataType: metadata?.constructor?.name || typeof metadata,
      };
    }
  }

  private saveLog(
    level: string,
    message: string,
    metadata?: unknown,
    emittedBy: string = this.defaultEmitter,
    operationName?: string,
    correlationId?: string,
  ): void {
    if (this.pendingLogs.length >= PrismaLogger.MAX_QUEUE_SIZE) {
      this.droppedLogs += 1;
      return;
    }

    this.pendingLogs.push({
      level: level.toLowerCase() as "trace" | "debug" | "info" | "warn" | "error" | "fatal",
      emittedBy,
      operationName: operationName || null,
      correlationId: correlationId || this.context.correlationId || null,
      message,
      metadata: this.normalizeMetadata(metadata),
      sessionId: this.context.sessionId,
      instance: this.context.instance,
    });

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushLogQueue().catch((error) => {
          console.error("Failed to flush logs to database:", error);
        });
      }, PrismaLogger.FLUSH_INTERVAL_MS);
    }
  }

  private async flushLogQueue(): Promise<void> {
    if (this.isFlushing) {
      return;
    }

    this.isFlushing = true;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    try {
      while (this.pendingLogs.length > 0) {
        const batch = this.pendingLogs.splice(0, PrismaLogger.BATCH_SIZE);
        await prisma.log.createMany({ data: batch });
      }

      if (this.droppedLogs > 0) {
        console.warn(`[PrismaLogger] Dropped ${this.droppedLogs} log entries because the queue is full`);
        this.droppedLogs = 0;
      }
    } catch (error) {
      console.error("Failed to save log batch to database:", error);
    } finally {
      this.isFlushing = false;
      if (this.pendingLogs.length > 0 && !this.flushTimer) {
        this.flushTimer = setTimeout(() => {
          this.flushLogQueue().catch((flushError) => {
            console.error("Failed to flush logs to database:", flushError);
          });
        }, PrismaLogger.FLUSH_INTERVAL_MS);
      }
    }
  }

  public override error(
    obj: unknown,
    msg?: string,
    emitter: string = this.defaultEmitter,
    operationName: string = "unknown",
    correlationId?: string,
  ): void {
    super.error(obj, msg, emitter, operationName);

    let message: string;
    let metadata: unknown = null;

    if (typeof obj === "string") {
      message = obj + (msg ? ` | ${msg}` : "");
    } else if (obj instanceof Error) {
      message = msg || obj.message;
      metadata = {
        name: obj.name,
        message: obj.message,
        stack: obj.stack,
      };
    } else {
      const objClassName = obj?.constructor?.name || "Object";
      message = `Error ocurred: ${msg || ""} | ObjType: ${objClassName}`;
      metadata = obj;
    }
    const formattedMsg = ConsoleLogger.formatMessage(message, emitter, operationName);
    this.saveLog("error", formattedMsg, metadata, emitter, operationName, correlationId);
  }

  public override warn(
    obj: unknown,
    msg?: string,
    emitter: string = this.defaultEmitter,
    operationName: string = "unknown",
    correlationId?: string,
  ): void {
    super.warn(obj, msg, emitter, operationName);

    let message: string;
    let metadata: unknown = null;

    if (typeof obj === "string") {
      message = obj + (msg ? ` | ${msg}` : "");
    } else {
      const objClassName = obj?.constructor?.name || "Object";
      message = `${msg || ""} | ObjType: ${objClassName}`;
      metadata = obj;
    }

    const formattedMsg = ConsoleLogger.formatMessage(message, emitter, operationName);
    this.saveLog("warn", formattedMsg, metadata, emitter, operationName, correlationId);
  }

  public override info(
    obj: unknown,
    msg?: string,
    emitter: string = this.defaultEmitter,
    operationName: string = "unknown",
    correlationId?: string,
  ): void {
    super.info(obj, msg, emitter, operationName);

    let message: string;
    let metadata: unknown = null;

    if (typeof obj === "string") {
      message = obj + (msg ? ` | ${msg}` : "");
    } else {
      const objClassName = obj?.constructor?.name || "Object";
      message = `${msg || ""} | ObjType: ${objClassName}`;
      metadata = obj;
    }

    const formattedMsg = ConsoleLogger.formatMessage(message, emitter, operationName);
    this.saveLog("info", formattedMsg, metadata, emitter, operationName, correlationId);
  }

  public override debug(
    obj: unknown,
    msg?: string,
    emitter: string = this.defaultEmitter,
    operationName: string = "unknown",
    correlationId?: string,
  ): void {
    super.debug(obj, msg, emitter, operationName);

    let message: string;
    let metadata: unknown = null;

    if (typeof obj === "string") {
      message = obj + (msg ? ` | ${msg}` : "");
    } else {
      message = msg || "no message";
      metadata = obj;
    }

    const formattedMsg = ConsoleLogger.formatMessage(message, emitter, operationName);
    this.saveLog("debug", formattedMsg, metadata, emitter, operationName, correlationId);
  }

  public override trace(
    obj: unknown,
    msg?: string,
    emitter: string = this.defaultEmitter,
    operationName: string = "unknown",
    correlationId?: string,
  ): void {
    super.trace(obj, msg, emitter, operationName);

    let message: string;
    let metadata: unknown = null;

    if (typeof obj === "string") {
      message = `[TRACE] ${obj}${msg ? ` | ${msg}` : ""}`;
    } else {
      message = `[TRACE] ${msg || ""}`;
      metadata = obj;
    }

    const formattedMsg = ConsoleLogger.formatMessage(message, emitter, operationName, true);
    this.saveLog("trace", formattedMsg, metadata, emitter, operationName, correlationId);
  }
}