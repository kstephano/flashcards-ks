import { db } from '@/lib/db';
import { generationJobs } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import pino from 'pino';

const log = pino();

export async function claimNextJob(): Promise<string | null> {
  const result = await db.execute(sql`
    UPDATE generation_jobs
    SET status = 'running', started_at = NOW()
    WHERE id = (
      SELECT id FROM generation_jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `);
  const rows = result.rows as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

export async function checkCancelled(jobId: string): Promise<boolean> {
  const job = await db.query.generationJobs.findFirst({
    where: eq(generationJobs.id, jobId),
    columns: { status: true },
  });
  return job?.status === 'cancelled';
}

export async function updateJobProgress(
  jobId: string,
  pct: number,
  step: 'structure' | 'enrich' | 'generate' | 'judge' | 'regenerate' | 'persist',
): Promise<void> {
  await db
    .update(generationJobs)
    .set({ progressPct: pct, currentStep: step })
    .where(eq(generationJobs.id, jobId));
  log.info({ jobId, step, pct }, 'job progress updated');
}

export async function failJob(jobId: string, error: string): Promise<void> {
  await db
    .update(generationJobs)
    .set({ status: 'failed', errorMessage: error, completedAt: new Date() })
    .where(eq(generationJobs.id, jobId));
  log.error({ jobId, error }, 'job failed');
}

export async function completeJob(
  jobId: string,
  deckId: string,
  actualCostUsd: number,
): Promise<void> {
  await db
    .update(generationJobs)
    .set({
      status: 'complete',
      deckId,
      actualCostUsd: actualCostUsd.toFixed(4),
      completedAt: new Date(),
    })
    .where(eq(generationJobs.id, jobId));
  log.info({ jobId, deckId, actualCostUsd }, 'job completed');
}
