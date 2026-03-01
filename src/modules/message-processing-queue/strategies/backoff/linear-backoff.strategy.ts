import { BackoffStrategy } from "./backoff.strategy";

class LinearBackoff implements BackoffStrategy {
  constructor(private readonly delayMs: number = 5000) { }

  getNextAttemptAt(_attempt: number): Date {
    return new Date(Date.now() + this.delayMs);
  }
}

export default LinearBackoff;