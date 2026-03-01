import { BackoffStrategy } from "./backoff.strategy";

interface IncreasingBackoffOptions {
  delays?: number[];
}

const ONE_SECOND_MS = 1000;
const TEN_SECONDS_MS = 10 * ONE_SECOND_MS;
const HALF_MINUTE_MS = 30 * ONE_SECOND_MS;
const ONE_MINUTE_MS = 60 * ONE_SECOND_MS;
const FIVE_MINUTES_MS = 5 * ONE_MINUTE_MS;
const TEN_MINUTES_MS = 10 * ONE_MINUTE_MS;
const HALF_HOUR_MS = 30 * ONE_MINUTE_MS;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const TWO_HOURS_MS = 2 * ONE_HOUR_MS;
const FOUR_HOURS_MS = 4 * ONE_HOUR_MS;

const DEFAULT_DELAYS = [
  ONE_SECOND_MS,
  TEN_SECONDS_MS,
  HALF_MINUTE_MS,
  ONE_MINUTE_MS,
  FIVE_MINUTES_MS,
  TEN_MINUTES_MS,
  HALF_HOUR_MS,
  ONE_HOUR_MS,
  TWO_HOURS_MS,
  FOUR_HOURS_MS,
];

class IncreasingBackoff implements BackoffStrategy {
  private readonly delays: number[];
  private readonly maxDelayMs: number;

  constructor(options: IncreasingBackoffOptions = {}) {
    this.delays = options.delays ?? DEFAULT_DELAYS;
    this.maxDelayMs = Math.max(...this.delays);
  }

  getNextAttemptAt(attempt: number): Date {
    const delay = this.delays[Math.min(attempt - 1, this.delays.length - 1)] ?? this.maxDelayMs;
    return new Date(Date.now() + delay);
  }
}

export default IncreasingBackoff;