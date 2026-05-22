import { db } from '@/lib/db';
import {
  decks,
  cards,
  droppedCards,
  generationJobs,
  generationCache,
  apiUsageLog,
  sourcePdfs,
} from '@/lib/db/schema';
import { eq, sum } from 'drizzle-orm';
import { completeJob, updateJobProgress } from '@/lib/jobs/queue';
import { buildCacheKey } from '@/lib/cache/generation-cache';
import type { JudgedCard } from './judge';
import type { DroppedCardData } from './regenerate';
import pino from 'pino';

const log = pino();

export async function runPersistStep(
  jobId: string,
  finalCards: JudgedCard[],
  droppedCardData: DroppedCardData[],
): Promise<string> {
  await updateJobProgress(jobId, 90, 'persist');

  const job = await db.query.generationJobs.findFirst({
    where: eq(generationJobs.id, jobId),
  });
  if (!job) throw new Error(`Job ${jobId} not found`);
  if (!job.targetSectionId) throw new Error('Job has no target section');

  // Create deck
  const [deck] = await db
    .insert(decks)
    .values({
      sectionId: job.targetSectionId,
      name: job.examName
        ? `${job.examName} — AI Generated`
        : 'AI Generated Deck',
      sourcePdfId: job.sourcePdfId,
      examName: job.examName,
    })
    .returning();

  // Insert cards with SRS defaults
  const now = new Date();
  if (finalCards.length > 0) {
    await db.insert(cards).values(
      finalCards.map((c) => ({
        deckId: deck.id,
        cardType: c.card_type,
        front: c.front,
        back: c.back,
        explanation: c.explanation ?? null,
        sourcePage: c.source_page,
        sourceQuote: c.source_quote,
        difficulty: c.difficulty,
        tags: c.tags,
        accuracyScore: c.accuracyScore,
        relevanceScore: c.relevanceScore,
        judgeRationale: c.judgeRationale,
        wasRegenerated: (c as JudgedCard & { wasRegenerated?: boolean }).wasRegenerated ?? false,
        promptTemplateVersion: (c as JudgedCard & { promptTemplateVersion?: string }).promptTemplateVersion ?? null,
        easeFactor: 2.5,
        intervalDays: 0,
        repetitions: 0,
        dueDate: now,
      })),
    );
  }

  // Insert dropped cards
  if (droppedCardData.length > 0) {
    await db.insert(droppedCards).values(
      droppedCardData.map((d) => ({
        deckId: deck.id,
        attemptedFront: d.attemptedFront,
        attemptedBack: d.attemptedBack,
        finalAccuracyScore: d.finalAccuracyScore,
        finalRelevanceScore: d.finalRelevanceScore,
        finalRationale: d.finalRationale,
        attempts: d.attempts,
      })),
    );
  }

  // Sum actual cost from api_usage_log for this job
  const costResult = await db
    .select({ total: sum(apiUsageLog.costUsd) })
    .from(apiUsageLog)
    .where(eq(apiUsageLog.jobId, jobId));
  const actualCostUsd = Number(costResult[0]?.total ?? 0);

  // Write to generation cache
  const pdfRecord = await db.query.sourcePdfs.findFirst({
    where: (t, { eq }) => eq(t.id, job.sourcePdfId),
  });
  if (pdfRecord) {
    const cacheKey = buildCacheKey({
      pdfHash: pdfRecord.sha256Hash,
      examName: job.examName,
      requestedCardCount: job.requestedCardCount,
      maxWebSearches: job.maxWebSearches,
    });
    const deckJson = { cards: finalCards, dropped: droppedCardData };
    await db
      .insert(generationCache)
      .values({ cacheKey, outputDeckJson: deckJson })
      .onConflictDoNothing();
  }

  await completeJob(jobId, deck.id, actualCostUsd);
  await updateJobProgress(jobId, 100, 'persist');

  log.info({ jobId, deckId: deck.id, cardCount: finalCards.length, actualCostUsd }, 'persist step complete');
  return deck.id;
}
