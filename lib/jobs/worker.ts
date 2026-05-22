import { claimNextJob, checkCancelled, failJob } from './queue';
import { runStructureStep } from './steps/structure';
import { runEnrichStep } from './steps/enrich';
import { runGenerateStep } from './steps/generate';
import { runJudgeStep } from './steps/judge';
import { runRegenerateStep } from './steps/regenerate';
import { runPersistStep } from './steps/persist';
import { getSignedUrl } from '@/lib/pdf/storage';
import { db } from '@/lib/db';
import { generationJobs, sourcePdfs } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import pino from 'pino';

const log = pino();

export async function runWorkerTick(): Promise<{ processed: boolean }> {
  // Check for approved jobs waiting to continue
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
    columns: { status: true, sourcePdfId: true, examName: true },
  });
  if (!job) return { processed: false };

  try {
    if (job.status === 'pending') {
      await runStructureStep(jobId);
      return { processed: true };
    }

    if (job.status === 'awaiting_outline_approval') {
      // Enrich
      await runEnrichStep(jobId);
      if (await checkCancelled(jobId)) return { processed: true };

      // Generate
      const rawCards = await runGenerateStep(jobId);
      if (await checkCancelled(jobId)) return { processed: true };

      // Judge
      const judgedCards = await runJudgeStep(rawCards, job.examName, jobId);
      if (await checkCancelled(jobId)) return { processed: true };

      // Get signed URL for regeneration (same PDF)
      const pdfRecord = await db.query.sourcePdfs.findFirst({
        where: eq(sourcePdfs.id, job.sourcePdfId),
        columns: { storagePath: true },
      });
      const signedUrl = pdfRecord ? await getSignedUrl(pdfRecord.storagePath, 7200) : '';

      // Regenerate rejected cards
      const { accepted, dropped } = await runRegenerateStep(
        judgedCards,
        job.examName,
        jobId,
        signedUrl,
      );
      if (await checkCancelled(jobId)) return { processed: true };

      // Persist
      await runPersistStep(jobId, accepted, dropped);
      return { processed: true };
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    log.error({ jobId, error: message }, 'worker tick error');
    await failJob(jobId, message);
  }

  return { processed: false };
}
