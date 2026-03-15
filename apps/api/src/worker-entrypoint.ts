// Standalone capture worker process -- no HTTP server.
// Used by Dockerfile.capture for the capture-worker container.
import { startWorkers } from './workers/index.js';

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  console.error('[worker] REDIS_URL environment variable is required');
  process.exit(1);
}

console.log('[worker] Starting capture worker (standalone)...');
await startWorkers(REDIS_URL);
console.log('[worker] Capture worker ready, processing jobs...');
