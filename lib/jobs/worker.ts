import { claimNextJob, checkCancelled, failJob } from './queue';
import { runStructureStep } from './steps/structure';
import { db } from '@/lib/db';
import { generationJobs } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import pino from 'pino';

const log = pino();

// Stub imports — these modules will be created in Phase 4
async function runEnrichStep(_jobId: string): Promise<void> {
  throw new Error('Enrich step not yet implemented');
}
async function runGenerateStep(_jobId: string): Promise<void> {
  throw new Error('Generate step not yet implemented');
}
async function runJudgeAndPersistStep(_jobId: string): Promise<void> {
  throw new Error('Judge and persist step not yet implemented');
}

export async function runWorkerTick(): Promise<{ processed: boolean }> {
  // Check for approved jobs waiting to continue past outline approval
  const resumableJob = await db.query.generationJobs.findFirst({
    where: and(
      eq(generationJobs.status, 'awaiting_outline_approval'),
      isNotNull(generationJobs.outlineApprovedAt),
    ),
    columns: { id: true },
  });

  const jobId = resumableJob?.id ?? (await claimNextJob());
  if (!jobId) return { processed: false };

  log.info({ jobId }, 'worker tick: processing job');

  const job = await db.query.generationJobs.findFirst({
    where: eq(generationJobs.id, jobId),
    columns: { status: true },
  });
  if (!job) return { processed: false };

  try {
    if (job.status === 'pending') {
      await runStructureStep(jobId);
      return { processed: true };
    }

    if (job.status === 'awaiting_outline_approval') {
      if (await checkCancelled(jobId)) return { processed: true };
      await runEnrichStep(jobId);
      if (await checkCancelled(jobId)) return { processed: true };
      await runGenerateStep(jobId);
      if (await checkCancelled(jobId)) return { processed: true };
      await runJudgeAndPersistStep(jobId);
      return { processed: true };
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    log.error({ jobId, error: message }, 'worker tick error');
    await failJob(jobId, message);
  }

  return { processed: false };
}
