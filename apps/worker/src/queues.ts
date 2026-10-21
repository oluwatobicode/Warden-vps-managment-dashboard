import { Queue } from "bullmq";
import { QUEUES } from "shared-types";
import { redis } from "./redis";

// Finished jobs are dropped (one per server per minute adds up); failed ones
// are kept briefly for debugging.
const defaultJobOptions = { removeOnComplete: true, removeOnFail: 200 };

export const monitoringQueue = new Queue(QUEUES.monitoring, { connection: redis, defaultJobOptions });
export const backupQueue = new Queue(QUEUES.backups, { connection: redis, defaultJobOptions });
