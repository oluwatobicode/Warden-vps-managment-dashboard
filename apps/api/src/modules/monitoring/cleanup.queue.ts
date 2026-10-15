import { Queue } from 'bullmq';
import { QUEUES } from 'shared-types';
import { RedisService } from '../../redis/redis.service';

/** Nest token for the producer side of the worker's docker-cleanup queue. */
export const CLEANUP_QUEUE = Symbol('CLEANUP_QUEUE');

export const cleanupQueueProvider = {
  provide: CLEANUP_QUEUE,
  inject: [RedisService],
  // Same Redis as sessions; the worker consumes from the same queue name.
  useFactory: (redis: RedisService) =>
    new Queue(QUEUES.cleanup, {
      connection: redis,
      defaultJobOptions: { removeOnComplete: true, removeOnFail: 200 },
    }),
};
