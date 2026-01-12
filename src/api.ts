import express, { Request, Response, Router } from "express";
import WhatsappClient from "./modules/whatsapp/clients/whatsapp-client";
import type { FetchMessageHistoryOptions } from "./modules/whatsapp/types";

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

    this.app.use(express.json());
    this.app.use("/api", this.router);
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

  private async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.client.sendMessage(req.body);
      res.status(201).send(result);
    } catch (error) {
      res.status(500).send(error);
    }
  }

  private async editMessage(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.client.editMessage(req.body);
      res.status(200).send(result);
    } catch (error) {
      res.status(500).send(error);
    }
  }

  private async fetchMessageHistory(req: Request, res: Response): Promise<void> {
    try {
      const options: FetchMessageHistoryOptions = req.body;
      const result = await this.client.fetchMessageHistory(options);
      res.status(200).send(result);
    } catch (error) {
      res.status(500).send(error);
    }
  }
}

export default ExpressApi;
