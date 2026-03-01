import { JobProcessor } from "./job-processor";

/**
 * Processador para mensagens EDIT
 * Implemente aqui a lógica de edição de mensagens
 */
export class EditProcessor implements JobProcessor {
  async process(_messageId: string): Promise<void> {
    // TODO: Implementar lógica de edição
    // 1. Recuperar a RawMessage do banco
    // 2. Converter para InpulseMessage usando BaileysMessageAdapter
    // 3. Atualizar InpulseMessage no banco
    // 4. Emitir evento HTTP
    throw new Error("EditProcessor.process() not implemented");
  }
}

