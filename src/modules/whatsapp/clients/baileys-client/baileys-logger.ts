import { Logger } from "@in.pulse-crm/utils";
import { ILogger } from "baileys/lib/Utils/logger";

export class BaileysLogger implements ILogger {
  public level: string;

  constructor(level: string) {
    this.level = level;
  }

  public error(obj: unknown, msg?: string): void {
    if (typeof obj === "string") {
      Logger.error(obj + (msg ? ` | ${msg}` : ""));
    } else if (obj instanceof Error) {
      Logger.error(msg || obj.message, obj);
    } else {
      const objClassName = obj?.constructor?.name || "Object";
      Logger.error(`Error ocurred: ${msg || ""} | ObjType: ${objClassName}`, obj as any);
    }
  }

  public warn(obj: unknown, msg?: string): void {
    if (typeof obj === "string") {
      Logger.warning(obj + (msg ? ` | ${msg}` : ""));
    } else {
      const objClassName = obj?.constructor?.name || "Object";
      Logger.warning(`${msg || ""} | ObjType: ${objClassName}`);
      console.log(obj);
    }
  }

  public info(obj: unknown, msg?: string): void {
    if (typeof obj === "string") {
      Logger.info(obj + (msg ? ` | ${msg}` : ""));
    } else {
      const objClassName = obj?.constructor?.name || "Object";
      Logger.info(`${msg || ""} | ObjType: ${objClassName}`);
      console.log(obj);
    }
  }

  public child(): ILogger {
    return this;
  }

  public debug(obj: unknown, msg?: string): void {
    if (typeof obj === "string") {
      Logger.debug(obj + (msg ? ` | ${msg}` : ""));
    } else {
      Logger.debug(`${msg || "no message"}`, obj);
    }
  }

  public trace(obj: unknown, msg?: string): void {
    if (typeof obj === "string") {
      Logger.debug(`[TRACE]` + obj + (msg ? ` | ${msg}` : ""));
    } else {

      Logger.debug(`[TRACE]` + `${msg || ""}`, obj);
    }
  }
}