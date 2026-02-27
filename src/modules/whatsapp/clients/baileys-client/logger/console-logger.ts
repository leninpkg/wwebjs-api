import chalk from 'chalk';
import { ILogger } from "baileys/lib/Utils/logger";

enum LogLevel {
  trace = 0,
  debug = 1,
  info = 2,
  warn = 3,
  error = 4,
  fatal = 5,
}

function getLevelText(level: LogLevel): string {
  switch (level) {
    case LogLevel.trace:
      return chalk.gray("[TRACE]".padEnd(7, " "));
    case LogLevel.debug:
      return chalk.magenta("[DEBUG]".padEnd(7, " "));
    case LogLevel.info:
      return chalk.blue("[INFO]".padEnd(7, " "));
    case LogLevel.warn:
      return chalk.yellow("[WARN]".padEnd(7));
    case LogLevel.error:
      return chalk.red("[ERROR]".padEnd(7, " "));
    case LogLevel.fatal:
      return chalk.bgRed.redBright("[FATAL]".padEnd(7, " "));
    default:
      return "[UNKN]".padEnd(7, " ");
  }
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

  private static log(level: LogLevel, emitter: string, processName: string, obj: unknown | string, msg?: string) {
    const lvl = getLevelText(level);
    const em = chalk.cyan(emitter);
    const pn = chalk.cyanBright(processName || "unknown");
    const ctx = `${em}:${pn}`.padEnd(42, " ");

    const date = chalk.green(new Date().toISOString().padEnd(24, " "));

    const prefix = `${date} ${lvl} ${ctx}| `;
    const message = ConsoleLogger.formatMsg(obj, msg);
    const hasObject = typeof obj !== "string";

    console.log(`${prefix}${message}`);
    if (hasObject) {
      console.dir(obj, { depth: null, colors: true });
    }
  }

  private static formatMsg(obj: unknown, msg?: string): string {
    if (typeof msg === "string") return msg;
    if (typeof obj === "string") return obj + (msg ? ` | ${msg}` : "");
    const objClassName = obj?.constructor?.name || "Object";
    return `{${objClassName}} - ` + (msg ? `${msg}` : "");
  }

  private shouldLog(messageLevel: LogLevel): boolean {
    return messageLevel >= this.levelValue;
  }

  public error(obj: unknown, msg?: string, emitter: string = this.defaultEmitter, processName: string = "unknown"): void {
    if (!this.shouldLog(LogLevel.error)) return;

    ConsoleLogger.log(LogLevel.error, emitter, processName, obj, msg);
  }

  public warn(obj: unknown, msg?: string, emitter: string = this.defaultEmitter, processName: string = "unknown"): void {
    if (!this.shouldLog(LogLevel.warn)) return;
    ConsoleLogger.log(LogLevel.warn, emitter, processName, obj, msg);
  }

  public info(obj: unknown, msg?: string, emitter: string = this.defaultEmitter, processName: string = "unknown"): void {
    if (!this.shouldLog(LogLevel.info)) return;
    ConsoleLogger.log(LogLevel.info, emitter, processName, obj, msg);
  }

  public child(): ILogger {
    return this;
  }

  public debug(obj: unknown, msg?: string, emitter: string = this.defaultEmitter, processName: string = "unknown"): void {
    if (!this.shouldLog(LogLevel.debug)) return;
    ConsoleLogger.log(LogLevel.debug, emitter, processName, obj, msg);
  }

  public trace(obj: unknown, msg?: string, emitter: string = this.defaultEmitter, processName: string = "unknown"): void {
    if (!this.shouldLog(LogLevel.trace)) return;
    ConsoleLogger.log(LogLevel.trace, emitter, processName, obj, msg);
  }
}