/**
 * Interface para processadores de jobs de mensagens
 */

export interface JobProcessor {
  /**
   * Processa um job de mensagem
   * @param messageId ID da mensagem a processar
   * @throws Lança erro se o processamento falhar (será feito retry)
   */
  process(messageId: string): Promise<void>;
}
