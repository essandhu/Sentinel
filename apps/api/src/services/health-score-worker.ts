import { Queue, Worker } from 'bullmq';
import { createDb } from '@sentinel-vrt/db';
import { createStorageClient } from '@sentinel-vrt/storage';
import { computeAllHealthScores } from './health-score-service.js';

const QUEUE_NAME = 'health-scores';

export function getHealthScoreQueue(connectionOptions: object): Queue {
  return new Queue(QUEUE_NAME, { connection: connectionOptions });
}

export async function startHealthScoreWorker(
  connectionOptions: object,
): Promise<Worker> {
  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const db = createDb(process.env.DATABASE_URL!);
      const storageClient = createStorageClient({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION ?? 'us-east-1',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY!,
          secretAccessKey: process.env.S3_SECRET_KEY!,
        },
      });
      const bucket = process.env.S3_BUCKET!;

      await computeAllHealthScores(db, { storageClient, bucket });
    },
    {
      connection: { ...connectionOptions, maxRetriesPerRequest: null as null },
      concurrency: 1,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 },
    },
  );

  return worker;
}

export async function scheduleHourlyAggregation(
  connectionOptions: object,
): Promise<void> {
  const queue = getHealthScoreQueue(connectionOptions);
  await queue.add(
    'compute',
    {},
    {
      repeat: { pattern: '0 * * * *' },
      jobId: 'health-score-hourly',
    },
  );
}
