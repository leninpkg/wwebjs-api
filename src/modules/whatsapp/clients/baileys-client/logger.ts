import "dotenv/config";
import { ILogger } from "baileys/lib/Utils/logger";

const BAILEYS_LOGS_LEVEL = process.env["BAILEYS_LOGS_LEVEL"] || "warn";

const logger: ILogger = {
  level: BAILEYS_LOGS_LEVEL,
  error: (msg) => {
    if (["error", "warn", "info", "debug", "trace"].includes(BAILEYS_LOGS_LEVEL)) {
      console.log(`[ERROR]`, msg);
    }
  },
  warn: (msg) => {
    if (["warn", "info", "debug", "trace"].includes(BAILEYS_LOGS_LEVEL)) {
      console.log(`[WARN]`, msg);
    }
  },
  info: (msg) => {
    if (["info", "debug", "trace"].includes(BAILEYS_LOGS_LEVEL)) {
      console.log(`[INFO]`, msg);
    }
  },
  child: (_msg) => {
    // console.log(`[CHILD LOGGER]`, msg);
    return logger;
  },
  debug: () => { },
  trace: () => { },
};

export default logger;