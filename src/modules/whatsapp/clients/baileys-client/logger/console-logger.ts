import { Logger } from "@in.pulse-crm/utils";
import { ILogger } from "baileys/lib/Utils/logger";

enum LogLevel {
  trace = 0,
  debug = 1,
  info = 2,
  warn = 3,
  error = 4,
  fatal = 5,
}

export class ConsoleLogger implements ILogger {
  public level: string;
  private levelValue: number;
  protected defaultEmitter: string;

  constructor(level: string, defaultEmitter: string) {
    this.level = level;
    this.levelValue = LogLevel[level.toLowerCase() as keyof typeof LogLevel] ?? LogLevel.info;
    this.defaultEmitter = defaultEmitter;
  }

  private shouldLog(messageLevel: LogLevel): boolean {
    return messageLevel >= this.levelValue;
  }

  public static formatMessage(msg: string, emitter: string, processName?: string, isTrace: boolean = false): string {
    const processPart = processName ? `|${processName}| ` : "";
    return `${isTrace ? "[TRACE] " : ""}(${emitter}) ${processPart}${msg}`;
  }

  public error(obj: unknown, msg?: string, emitter: string = this.defaultEmitter, processName: string = "unknown"): void {
    if (!this.shouldLog(LogLevel.error)) return;
    let message: string;
    let error: any = null;

    if (typeof obj === "string") {
      message = obj + (msg ? ` | ${msg}` : "");
    } else if (obj instanceof Error) {
      message = msg || obj.message;
      error = obj;
    } else {
      const objClassName = obj?.constructor?.name || "Object";
      message = `Error ocurred: ${msg || ""} | ObjType: ${objClassName}`;
      error = obj;
    }

    Logger.error(ConsoleLogger.formatMessage(message, emitter, processName), error);
  }

  public warn(obj: unknown, msg?: string, emitter: string = this.defaultEmitter, processName: string = "unknown"): void {
    if (!this.shouldLog(LogLevel.warn)) return;

    if (typeof obj === "string") {
      Logger.warning(ConsoleLogger.formatMessage(obj + (msg ? ` | ${msg}` : ""), emitter, processName));
    } else {
      const objClassName = obj?.constructor?.name || "Object";
      Logger.warning(ConsoleLogger.formatMessage(`Error ocurred: ${msg || ""} | ObjType: ${objClassName}`, emitter, processName));
      console.log(obj);
    }
  }

  public info(obj: unknown, msg?: string, emitter: string = this.defaultEmitter, processName: string = "unknown"): void {
    if (!this.shouldLog(LogLevel.info)) return;

    if (typeof obj === "string") {
      Logger.info(ConsoleLogger.formatMessage(obj + (msg ? ` | ${msg}` : ""), emitter, processName));
    } else {
      const objClassName = obj?.constructor?.name || "Object";
      Logger.info(ConsoleLogger.formatMessage(`Error ocurred: ${msg || ""} | ObjType: ${objClassName}`, emitter, processName));
      console.log(obj);
    }
  }

  public child(): ILogger {
    return this;
  }

  public debug(obj: unknown, msg?: string, emitter: string = this.defaultEmitter, processName: string = "unknown"): void {
    if (!this.shouldLog(LogLevel.debug)) return;

    if (typeof obj === "string") {
      Logger.debug(ConsoleLogger.formatMessage(obj + (msg ? ` | ${msg}` : ""), emitter, processName));
    } else {
      const objClassName = obj?.constructor?.name || "Object";
      Logger.debug(ConsoleLogger.formatMessage(`Error ocurred: ${msg || ""} | ObjType: ${objClassName}`, emitter, processName));
      console.log(obj);
    }
  }

  public trace(obj: unknown, msg?: string, emitter: string = this.defaultEmitter, processName: string = "unknown"): void {
    if (!this.shouldLog(LogLevel.trace)) return;

    if (typeof obj === "string") {
      Logger.debug(ConsoleLogger.formatMessage(obj + (msg ? ` | ${msg}` : ""), emitter, processName, true));
    } else {
      Logger.debug(ConsoleLogger.formatMessage(`${msg || ""}`, emitter, processName, true), obj);
    }
  }
}