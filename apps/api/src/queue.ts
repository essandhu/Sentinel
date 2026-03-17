import { Queue, FlowProducer } from 'bullmq';
import type { CaptureJobData } from '@sentinel-vrt/capture';
import type { FigmaResyncJobData } from './workers/figma-resync.js';
import { parseRedisUrl } from './workers/parse-redis-url.js';

export const QUEUE_NAME = 'capture';

/** Union of all job data types handled by the capture queue */
export type CaptureQueueJobData = CaptureJobData | FigmaResyncJobData;

let queue: Queue<CaptureQueueJobData> | null = null;

export function getCaptureQueue(): Queue<CaptureQueueJobData> {
  if (!queue) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error('REDIS_URL required for capture queue');
    const { maxRetriesPerRequest, ...queueConnection } = parseRedisUrl(redisUrl);
    queue = new Queue<CaptureQueueJobData>(QUEUE_NAME, {
      connection: queueConnection,
    });
  }
  return queue;
}

let flowProducer: FlowProducer | null = null;

export function getFlowProducer(): FlowProducer {
  if (!flowProducer) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error('REDIS_URL required for FlowProducer');
    const { maxRetriesPerRequest, ...flowConnection } = parseRedisUrl(redisUrl);
    flowProducer = new FlowProducer({
      connection: flowConnection,
    });
  }
  return flowProducer;
}
