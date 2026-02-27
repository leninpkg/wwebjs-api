import { CacheStore } from "baileys";
import { ILogger } from "baileys/lib/Utils/logger";
import { RedisClientType, createClient } from "redis";

class RedisCacheStore implements CacheStore {
  private readonly client: RedisClientType;

  private isReady = false;

  constructor(private readonly sessionId: string, private readonly logger: ILogger) {
    this.client = createClient(
      process.env["REDIS_URL"]
        ? {
          url: process.env["REDIS_URL"],
        }
        : undefined,
    );

    this.client.on("error", (error) => {
      this.logger.error(error, "Redis cache store error");
    });
  }

  private async ensureConnection() {
    if (this.isReady || this.client.isReady) {
      this.isReady = true;
      return;
    }

    if (!this.client.isOpen) {
      await this.client.connect();
    }

    this.isReady = true;
  }

  private cacheKey(key: string) {
    return `baileys:cache:${this.sessionId}:${key}`;
  }

  private parseValue<T>(value: string | null): T | undefined {
    if (value === null) {
      return undefined;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async get<T>(key: string): Promise<T> {
    await this.ensureConnection();
    const value = await this.client.get(this.cacheKey(key));
    return this.parseValue<T>(value) as T;
  }

  async set<T>(key: string, value: T) {
    await this.ensureConnection();
    await this.client.set(this.cacheKey(key), JSON.stringify(value));
  }

  async del(key: string) {
    await this.ensureConnection();
    await this.client.del(this.cacheKey(key));
  }

  async flushAll() {
    await this.ensureConnection();

    const pattern = this.cacheKey("*");
    const keys = await this.client.keys(pattern);

    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }
}

export default RedisCacheStore;