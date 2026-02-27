import express, { NextFunction, Request, Response, Router } from "express";
import { PrismaLogger } from "./modules/whatsapp/clients/baileys-client/logger/prisma-logger";
import WhatsappClient from "./modules/whatsapp/clients/whatsapp-client";


class ExpressApi {
  private client: WhatsappClient;
  private app: express.Express;
  private router: Router;
  private logger: PrismaLogger;;

  public constructor(client: WhatsappClient, logger: PrismaLogger) {
    this.client = client;
    this.logger = logger;

    this.app = express();
    this.router = Router();

    this.router.get("/health", this.healtCheck);
    this.router.post("/send-message", this.sendMessage.bind(this));
    this.router.post("/edit-message", this.editMessage.bind(this));
    this.router.get("/groups", this.getGroups.bind(this));

    this.app.use(express.json());
    this.app.use("/api", this.router);

    // Middleware global de tratamento de erros
    this.app.use(this.errorHandler.bind(this));
  }

  public listen(listenPort: number): void {
    this.app.listen(listenPort, () => {
      this.logger.info(`API server is running on port ${listenPort}`, undefined, "ExpressApi", "listen");
    });
  }

  private healtCheck(_req: Request, res: Response): void {
    res.status(200).send("OK");
  }

  private errorHandler(error: Error, _req: Request, res: Response, _next: NextFunction): void {
    this.logger.error(error, "Unhandled error in API request", "ExpressApi", "errorHandler");

    res.status(500).json({
      error: "Internal server error",
      message: error.message,
      details: error.stack
    });
  }

  private async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { isGroup, ...messageOptions } = req.body;

      const result = await this.client.sendMessage(messageOptions, isGroup || false);
      res.status(201).send(result);
    } catch (error) {
      this.logger.error(error, "Error sending message", "ExpressApi", "sendMessage");
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : undefined
      });
    }
  }

  private async editMessage(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.client.editMessage(req.body);
      res.status(200).send(result);
    } catch (error) {
      this.logger.error(error, "Error editing message", "ExpressApi", "editMessage");
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : undefined
      });
    }
  }

  private async getGroups(_req: Request, res: Response): Promise<void> {
    try {
      const groups = await this.client.getGroups();
      res.status(200).json({ groups });
    } catch (error) {
      this.logger.error(error, "Error fetching groups", "ExpressApi", "getGroups");
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : undefined
      });
    }
  }
}

export default ExpressApi;
