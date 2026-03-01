/**
 * Estratégias de backoff para retry da fila de processamento
 */

export interface BackoffStrategy {
  /**
   * Calcula o próximo tempo de tentativa baseado no número de tentativas
   */
  getNextAttemptAt(attempt: number): Date;
}