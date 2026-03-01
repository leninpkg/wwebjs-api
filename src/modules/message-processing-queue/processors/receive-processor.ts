import { JobProcessor } from "./job-processor";

/**
 * Processador para mensagens RECEIVE
 * Implemente aqui a lógica de recebimento de mensagens
 */
export class ReceiveProcessor implements JobProcessor {
  async process(_messageId: string): Promise<void> {
    // TODO: Implementar lógica de recebimento
    // 1. Recuperar a RawMessage do banco
    // 2. Converter para InpulseMessage usando BaileysMessageAdapter
    // 3. Salvar InpulseMessage no banco
    // 4. Emitir evento HTTP
    throw new Error("ReceiveProcessor.process() not implemented");
  }
}

