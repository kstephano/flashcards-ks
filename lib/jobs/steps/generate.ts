import { db } from '@/lib/db';
import { generationJobs, sectionGenerationStatus, sourcePdfs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { trackedMessage } from '@/lib/anthropic/client';
import { generateCardsTool } from '@/lib/anthropic/tools';
import { loadPrompt } from '@/lib/prompt-loader';
import { getSignedUrl } from '@/lib/pdf/storage';
import { updateJobProgress } from '@/lib/jobs/queue';
import type { SectionOutlineItem } from './structure';
import pino from 'pino';

const log = pino();

export interface RawCard {
  card_type: 'qa' | 'cloze' | 'multiple_choice';
  front: string;
  back: string;
  explanation?: string;
  source_page: number;
  source_quote: string;
  difficulty: number;
  tags: string[];
  sectionName: string;
}

const BACKOFF_MS = [2000, 8000, 32000];

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateSection(
  jobId: string,
  section: SectionOutlineItem,
  signedUrl: string,
  examName: string | null,
  enrichContext: string | null,
  cardCount: number,
  promptHash: string,
  promptContent: string,
): Promise<RawCard[]> {
  const sectionRecord = await db.query.sectionGenerationStatus.findFirst({
    where: (t, { eq, and }) => and(
      eq(t.jobId, jobId),
      eq(t.sectionName, section.name),
    ),
  });

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      if (sectionRecord) {
        await db
          .update(sectionGenerationStatus)
          .set({ status: 'running', attemptCount: attempt + 1, updatedAt: new Date() })
          .where(eq(sectionGenerationStatus.id, sectionRecord.id));
      }

      const prompt = promptContent
        .replace('{{card_count}}', String(cardCount))
        .replace('{{section_name}}', section.name)
        .replace('{{page_start}}', String(section.page_start))
        .replace('{{page_end}}', String(section.page_end))
        .replace('{{exam_name}}', examName ?? 'Not specified')
        .replace('{{enrich_context}}', enrichContext ?? 'No additional context available.');

      const response = await trackedMessage({
        model: 'sonnet',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'document', source: { type: 'url', url: signedUrl } } as never,
              { type: 'text', text: prompt },
            ] as never,
          },
        ],
        tools: [generateCardsTool],
        tool_choice: { type: 'tool', name: 'generate_cards' },
        jobId,
        sectionId: sectionRecord?.id,
        pipelineStep: 'generate',
        promptTemplateVersion: promptHash,
      });

      const toolUse = response.content.find((b) => b.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') throw new Error('No tool_use in generate response');

      const cards = (toolUse.input as { cards: RawCard[] }).cards.map((c) => ({
        ...c,
        sectionName: section.name,
      }));

      if (sectionRecord) {
        await db
          .update(sectionGenerationStatus)
          .set({ status: 'complete', updatedAt: new Date() })
          .where(eq(sectionGenerationStatus.id, sectionRecord.id));
      }

      log.info({ jobId, section: section.name, cardCount: cards.length }, 'section generated');
      return cards;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      log.warn({ jobId, section: section.name, attempt, error: message }, 'section generation failed, retrying');

      if (attempt < 2) {
        await sleep(BACKOFF_MS[attempt]);
      } else {
        if (sectionRecord) {
          await db
            .update(sectionGenerationStatus)
            .set({ status: 'failed', lastError: message, updatedAt: new Date() })
            .where(eq(sectionGenerationStatus.id, sectionRecord.id));
        }
        log.error({ jobId, section: section.name }, 'section generation failed after 3 attempts, skipping');
        return [];
      }
    }
  }
  return [];
}

export async function runGenerateStep(jobId: string): Promise<RawCard[]> {
  const job = await db.query.generationJobs.findFirst({
    where: eq(generationJobs.id, jobId),
  });
  if (!job) throw new Error(`Job ${jobId} not found`);

  const outline = job.pendingSectionOutline as SectionOutlineItem[] | null;
  if (!outline || outline.length === 0) {
    throw new Error('No approved section outline found for job');
  }

  const pdfRecord = await db.query.sourcePdfs.findFirst({
    where: eq(sourcePdfs.id, job.sourcePdfId),
  });
  if (!pdfRecord) throw new Error('Source PDF not found');

  const signedUrl = await getSignedUrl(pdfRecord.storagePath, 7200);

  // Create section status records (idempotent via onConflictDoNothing on PK)
  await db.insert(sectionGenerationStatus).values(
    outline.map((s) => ({ jobId, sectionName: s.name, status: 'pending' as const })),
  ).onConflictDoNothing();

  const { content: promptContent, hash: promptHash } = loadPrompt('generate_cards');
  const cardsPerSection = Math.ceil((job.requestedCardCount ?? outline.length * 20) / outline.length);

  const allCards: RawCard[] = [];

  for (let i = 0; i < outline.length; i++) {
    const section = outline[i];
    const pct = 30 + Math.round((i / outline.length) * 35);
    await updateJobProgress(jobId, pct, 'generate');

    const cards = await generateSection(
      jobId,
      section,
      signedUrl,
      job.examName,
      job.enrichContext,
      cardsPerSection,
      promptHash,
      promptContent,
    );
    allCards.push(...cards);
  }

  await updateJobProgress(jobId, 65, 'generate');
  log.info({ jobId, totalCards: allCards.length }, 'generate step complete');
  return allCards;
}
