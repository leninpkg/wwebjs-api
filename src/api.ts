import express, { Request, Response, Router, NextFunction } from "express";
import WhatsappClient from "./modules/whatsapp/clients/whatsapp-client";
import type { FetchMessageHistoryOptions } from "./modules/whatsapp/inpulse-types";
import { Logger } from "@in.pulse-crm/utils";

class ExpressApi {
  private client: WhatsappClient;
  private app: express.Express;
  private router: Router;

  private constructor(client: WhatsappClient) {
    this.client = client;
    this.app = express();
    this.router = Router();

    this.router.get("/health", this.healtCheck);
    this.router.post("/send-message", this.sendMessage.bind(this));
    this.router.post("/edit-message", this.editMessage.bind(this));
    this.router.post("/fetch-message-history", this.fetchMessageHistory.bind(this));
    this.router.get("/groups", this.getGroups.bind(this));

    this.app.use(express.json());
    this.app.use("/api", this.router);

    // Middleware global de tratamento de erros
    this.app.use(this.errorHandler.bind(this));
  }

  public static create(client: WhatsappClient): ExpressApi {
    return new ExpressApi(client);
  }

  public listen(listenPort: number): void {
    this.app.listen(listenPort, () => {
      console.log(`Server is running on port ${listenPort}`);
    });
  }

  private healtCheck(_req: Request, res: Response): void {
    res.status(200).send("OK");
  }

  private errorHandler(error: Error, req: Request, res: Response, _next: NextFunction): void {
    console.error("[API] Unhandled error in request:", {
      method: req.method,
      path: req.path,
      body: req.body,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: "Internal server error",
      message: error.message,
      details: error.stack
    });
  }

  private async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { isGroup, ...messageOptions } = req.body;

      Logger.debug("[API] Sending message with options:", messageOptions);

      const result = await this.client.sendMessage(messageOptions, isGroup || false);
      res.status(201).send(result);
    } catch (error) {
      console.error("[API] Error sending message:", error);
      console.error("[API] Request body:", JSON.stringify(req.body, null, 2));
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
      console.error("[API] Error editing message:", error);
      console.error("[API] Request body:", JSON.stringify(req.body, null, 2));
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : undefined
      });
    }
  }

  private async fetchMessageHistory(req: Request, res: Response): Promise<void> {
    try {
      const options: FetchMessageHistoryOptions = req.body;
      const result = await this.client.fetchMessageHistory(options);
      res.status(200).send(result);
    } catch (error) {
      console.error("[API] Error fetching message history:", error);
      console.error("[API] Request body:", JSON.stringify(req.body, null, 2));
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : undefined
      });
    }
  }

  private async getGroups(_req: Request, res: Response): Promise<void> {
    try {
      Logger.debug("[API] Fetching WhatsApp groups");
      const groups = await this.client.getGroups();
      res.status(200).json({ groups });
    } catch (error) {
      console.error("[API] Error fetching groups:", error);
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof Error ? error.stack : undefined
      });
    }
  }
}

export default ExpressApi;
