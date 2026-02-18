import { prisma } from "../../../../../prisma";
import { ConsoleLogger } from "./console-logger";

interface LogContext {
  sessionId: string;
  instance: string;
}

export class PrismaLogger extends ConsoleLogger {
  private context: LogContext;

  constructor(level: string, context: LogContext) {
    super(level);
    this.context = context;
  }

  private async saveLog(level: string, message: string, metadata?: unknown): Promise<void> {
    try {
      await prisma.log.create({
        data: {
          level: level.toLowerCase() as any,
          message,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
          sessionId: this.context.sessionId,
          instance: this.context.instance,
        },
      });

    } catch (error) {
      console.error("Failed to save log to database:", error);
    }
  }

  public override error(obj: unknown, msg?: string): void {
    super.error(obj, msg);

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

    this.saveLog("error", message, metadata);
  }

  public override warn(obj: unknown, msg?: string): void {
    super.warn(obj, msg);

    let message: string;
    let metadata: unknown = null;

    if (typeof obj === "string") {
      message = obj + (msg ? ` | ${msg}` : "");
    } else {
      const objClassName = obj?.constructor?.name || "Object";
      message = `${msg || ""} | ObjType: ${objClassName}`;
      metadata = obj;
    }

    this.saveLog("warn", message, metadata);
  }

  public override info(obj: unknown, msg?: string): void {
    super.info(obj, msg);

    let message: string;
    let metadata: unknown = null;

    if (typeof obj === "string") {
      message = obj + (msg ? ` | ${msg}` : "");
    } else {
      const objClassName = obj?.constructor?.name || "Object";
      message = `${msg || ""} | ObjType: ${objClassName}`;
      metadata = obj;
    }

    this.saveLog("info", message, metadata);
  }

  public override debug(obj: unknown, msg?: string): void {
    super.debug(obj, msg);

    let message: string;
    let metadata: unknown = null;

    if (typeof obj === "string") {
      message = obj + (msg ? ` | ${msg}` : "");
    } else {
      message = msg || "no message";
      metadata = obj;
    }

    this.saveLog("debug", message, metadata);
  }

  public override trace(obj: unknown, msg?: string): void {
    super.trace(obj, msg);

    let message: string;
    let metadata: unknown = null;

    if (typeof obj === "string") {
      message = `[TRACE] ${obj}${msg ? ` | ${msg}` : ""}`;
    } else {
      message = `[TRACE] ${msg || ""}`;
      metadata = obj;
    }

    this.saveLog("trace", message, metadata);
  }
}