import { ILogger } from "baileys/lib/Utils/logger";
import { prisma } from "../../../../../prisma";
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
  private static readonly MAX_STRING_LENGTH = 2_000;
  private static readonly MAX_ARRAY_ITEMS = 50;
  private static readonly MAX_OBJECT_KEYS = 50;
  private static readonly MAX_METADATA_LENGTH = 10_000;

  private context: LogContext;
  private readonly pendingLogs: Array<{
    level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
    emittedBy: string;
    operationName: string | null;
    correlationId: string | null;
    message: string;
    metadata: string;
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

  public getCorrelatedLogger(emitter: string, operationName: string, correlationId?: string): ILogger {
    const logger: ILogger = {
      level: this.level,
      error: (obj: unknown, msg?: string) => {
        this.error(obj, msg, emitter, operationName, correlationId);
      },
      warn: (obj: unknown, msg?: string) => {
        this.warn(obj, msg, emitter, operationName, correlationId);
      },
      info: (obj: unknown, msg?: string) => {
        this.info(obj, msg, emitter, operationName, correlationId);
      },
      debug: (obj: unknown, msg?: string) => {
        this.debug(obj, msg, emitter, operationName, correlationId);
      },
      trace: (obj: unknown, msg?: string) => {
        this.trace(obj, msg, emitter, operationName, correlationId);
      },
      child: (_obj: Record<string, unknown>) => {
        return this;
      }
    };

    return logger;
  }

  private normalizeMetadata(metadata?: unknown): string {
    if (typeof metadata === "undefined" || metadata === null) {
      return JSON.stringify(null);
    }

    try {
      const visited = new WeakSet<object>();

      const serialized = JSON.stringify(metadata, (_key, value) => {
        if (typeof value === "string" && value.length > PrismaLogger.MAX_STRING_LENGTH) {
          return `${value.slice(0, PrismaLogger.MAX_STRING_LENGTH)}...[omitted ${value.length - PrismaLogger.MAX_STRING_LENGTH} chars]`;
        }

        if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
          return `[Buffer omitted: ${value.length} bytes]`;
        }

        if (Array.isArray(value) && value.length > PrismaLogger.MAX_ARRAY_ITEMS) {
          return {
            omitted: true,
            reason: "array_too_large",
            originalLength: value.length,
            preview: value.slice(0, PrismaLogger.MAX_ARRAY_ITEMS),
          };
        }

        if (value && typeof value === "object") {
          if (visited.has(value)) {
            return "[Circular]";
          }
          visited.add(value);

          const entries = Object.entries(value as Record<string, unknown>);
          if (entries.length > PrismaLogger.MAX_OBJECT_KEYS) {
            return {
              omitted: true,
              reason: "object_too_large",
              originalKeys: entries.length,
              preview: Object.fromEntries(entries.slice(0, PrismaLogger.MAX_OBJECT_KEYS)),
            };
          }
        }

        return value;
      });

      if (!serialized) {
        return JSON.stringify(null);
      }

      if (serialized.length <= PrismaLogger.MAX_METADATA_LENGTH) {
        return serialized;
      }

      return JSON.stringify({
        omitted: true,
        reason: "metadata_too_large",
        originalLength: serialized.length,
        preview: serialized.slice(0, PrismaLogger.MAX_METADATA_LENGTH),
      });
    } catch {
      return JSON.stringify({
        serializationError: "Failed to serialize metadata",
        metadataType: metadata?.constructor?.name || typeof metadata,
      });
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
    operationName: string = "untracked",
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
    this.saveLog("error", message, metadata, emitter, operationName, correlationId);
  }

  public override warn(
    obj: unknown,
    msg?: string,
    emitter: string = this.defaultEmitter,
    operationName: string = "untracked",
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

    this.saveLog("warn", message, metadata, emitter, operationName, correlationId);
  }

  public override info(
    obj: unknown,
    msg?: string,
    emitter: string = this.defaultEmitter,
    operationName: string = "untracked",
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

    this.saveLog("info", message, metadata, emitter, operationName, correlationId);
  }

  public override debug(
    obj: unknown,
    msg?: string,
    emitter: string = this.defaultEmitter,
    operationName: string = "untracked",
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

    this.saveLog("debug", message, metadata, emitter, operationName, correlationId);
  }

  public override trace(
    obj: unknown,
    msg?: string,
    emitter: string = this.defaultEmitter,
    operationName: string = "untracked",
    correlationId?: string,
  ): void {
    super.trace(obj, msg, emitter, operationName);

    let message: string;
    let metadata: unknown = null;

    if (typeof obj === "string") {
      message = `${obj}${msg ? ` | ${msg}` : ""}`;
    } else {
      message = `${msg || ""}`;
      metadata = obj;
    }

    this.saveLog("trace", message, metadata, emitter, operationName, correlationId);
  }
}