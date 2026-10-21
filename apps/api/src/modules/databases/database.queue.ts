import { Queue } from 'bullmq';
import { QUEUES } from 'shared-types';
import { RedisService } from '../../redis/redis.service';

/** Nest token for the producer side of the worker's databases queue. */
export const DATABASE_QUEUE = Symbol('DATABASE_QUEUE');

export const databaseQueueProvider = {
  provide: DATABASE_QUEUE,
  inject: [RedisService],
  useFactory: (redis: RedisService) =>
    new Queue(QUEUES.databases, {
      connection: redis,
      defaultJobOptions: { removeOnComplete: true, removeOnFail: 200 },
    }),
};

/** Producer side of the worker's database-backups queue. */
export const BACKUP_QUEUE = Symbol('BACKUP_QUEUE');

export const backupQueueProvider = {
  provide: BACKUP_QUEUE,
  inject: [RedisService],
  useFactory: (redis: RedisService) =>
    new Queue(QUEUES.backups, {
      connection: redis,
      defaultJobOptions: { removeOnComplete: true, removeOnFail: 200 },
    }),
};
