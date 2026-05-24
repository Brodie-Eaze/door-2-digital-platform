/**
 * Redis singleton — used by rate limiter, idempotency cache, session store,
 * BullMQ queues, and Ably grant cache.
 */
import IORedis from 'ioredis';
import { env } from './env';

let _redis: IORedis | undefined;

export function redis(): IORedis {
  if (!_redis) {
    _redis = new IORedis(env().REDIS_URL, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: true,
    });
  }
  return _redis;
}

export async function shutdownRedis(): Promise<void> {
  await _redis?.quit();
}
