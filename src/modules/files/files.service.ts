import { FilesClient } from "@in.pulse-crm/sdk";
import "dotenv/config";

const FILES_API_URL = process.env["FILES_API_URL"] || "https://inpulse.infotecrs.inf.br";

export default new FilesClient(FILES_API_URL);
