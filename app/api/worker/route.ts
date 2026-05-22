import { NextRequest, NextResponse } from 'next/server';
import { runWorkerTick } from '@/lib/jobs/worker';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-worker-secret');
  if (!secret || secret !== process.env.WORKER_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const result = await runWorkerTick();
  return NextResponse.json(result);
}
