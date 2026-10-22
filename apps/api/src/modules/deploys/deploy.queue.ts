import { Queue } from 'bullmq';
import { QUEUES } from 'shared-types';
import { RedisService } from '../../redis/redis.service';

/** Producer side of the worker's deploys queue (deploys + proxy setup). */
export const DEPLOY_QUEUE = Symbol('DEPLOY_QUEUE');

export const deployQueueProvider = {
  provide: DEPLOY_QUEUE,
  inject: [RedisService],
  useFactory: (redis: RedisService) =>
    new Queue(QUEUES.deploys, {
      connection: redis,
      defaultJobOptions: { removeOnComplete: true, removeOnFail: 200 },
    }),
};
