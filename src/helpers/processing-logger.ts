import { Logger, sanitizeErrorMessage } from "@in.pulse-crm/utils";
import DataClient from "../modules/data/data-client";

interface LogEntry {
  timestamp: string;
  level: "INFO" | "DEBUG" | "ERROR";
  message: string;
  data?: unknown;
}

export default class ProcessingLogger {
  private readonly logEntries: LogEntry[] = [];
  private readonly startTime: Date = new Date();
  private endTime: Date | null = null;
  private output: Array<any> = [];
  private error: unknown = null;

  constructor(
    private readonly storage: DataClient,
    private readonly instance: string,
    public processName: string,
    private readonly processId: string,
    private readonly input: unknown,
    private displayOnTerminal: boolean = false,
  ) {}

  public log(message: string, data?: unknown): void {
    this.logEntries.push({
      timestamp: new Date().toISOString(),
      level: "INFO",
      message,
      data,
    });
    if (data !== undefined) {
      this.output.push(data);
    }
    if (this.displayOnTerminal) {
      Logger.info(message);
      Logger.debug("DATA:", data);
    }
  }

  public debug(message: string, data?: unknown): void {
    this.logEntries.push({
      timestamp: new Date().toISOString(),
      level: "DEBUG",
      message,
      data,
    });

    // Também exibe no console para debugging em tempo real
    if (data !== undefined) {
      console.log(`[DEBUG] ${message}`, data);
    } else {
      console.log(`[DEBUG] ${message}`);
    }
  }

  public success(result: unknown): void {
    this.output.push(result);
    this.endTime = new Date();
    this.save().catch((err) => Logger.error("Failed to save logs", err as Error));
  }

  public failed(err: unknown): void {
    this.error = err;
    this.endTime = new Date();
    this.save().catch((err) => Logger.error("Failed to save logs", err as Error));
  }

  private async save(): Promise<void> {
    try {
      const duration = this.endTime!.getTime() - this.startTime.getTime();
      const hasError = this.error !== null;

      // Salvar log principal na tabela processing_logs
      const mainLogQuery = `
        INSERT INTO logs (
          instance,
          process_name,
          process_id,
          start_time,
          end_time,
          duration_ms,
          logs_entries,
          input,
          output,
          has_error,
          error,
          error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const result = await this.storage.unsafeQuery(mainLogQuery, [
        this.instance,
        this.processName,
        this.processId,
        new Date(this.startTime),
        new Date(this.endTime!),
        duration,
        JSON.stringify(this.logEntries),
        JSON.stringify(this.input),
        JSON.stringify(this.output),
        hasError,
        hasError ? JSON.stringify(this.error) : null,
        hasError ? sanitizeErrorMessage(this.error) : null,
      ]);

      const mainLogId = (result as any).insertId;

      // Salvar cada entrada de log individual na tabela logs_entries
      for (const entry of this.logEntries) {
        const entryQuery = `
          INSERT INTO logs_entries (
            log_id,
            process_id,
            log_message,
            log_level,
            log_data,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `;

        await this.storage.unsafeQuery(entryQuery, [
          mainLogId,
          this.processId,
          entry.message,
          entry.level,
          entry.data ? JSON.stringify(entry.data) : null,
          new Date(entry.timestamp),
        ]);
      }
    } catch (err) {
      Logger.error("Failed to save logs to database", err as Error);
    }
  }
}
