import 'dotenv/config';

const INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 3000);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const WORKER_URL = `${APP_URL}/api/worker`;
const SECRET = process.env.WORKER_SECRET ?? '';

async function tick(): Promise<void> {
  try {
    const res = await fetch(WORKER_URL, {
      headers: { 'x-worker-secret': SECRET },
    });
    if (!res.ok) {
      console.error(`[worker] HTTP ${res.status} from worker route`);
      return;
    }
    const data = (await res.json()) as { processed: boolean };
    if (data.processed) {
      console.log('[worker] processed a job tick');
    }
  } catch (e) {
    console.error('[worker] fetch error:', e);
  }
}

void (async () => {
  console.log('[worker] starting, poll interval:', INTERVAL_MS, 'ms');
  while (true) {
    await tick();
    await new Promise<void>((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
})();
