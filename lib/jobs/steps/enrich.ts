import { db } from '@/lib/db';
import { generationJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { trackedMessage } from '@/lib/anthropic/client';
import { loadPrompt } from '@/lib/prompt-loader';
import { updateJobProgress } from '@/lib/jobs/queue';
import type Anthropic from '@anthropic-ai/sdk';
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages/messages';
import pino from 'pino';

const log = pino();

export async function runEnrichStep(jobId: string): Promise<void> {
  const job = await db.query.generationJobs.findFirst({
    where: eq(generationJobs.id, jobId),
  });
  if (!job) throw new Error(`Job ${jobId} not found`);

  if (!job.examName) {
    log.info({ jobId }, 'enrich step skipped: no exam name');
    await db
      .update(generationJobs)
      .set({ progressPct: 25, enrichContext: null })
      .where(eq(generationJobs.id, jobId));
    return;
  }

  await updateJobProgress(jobId, 20, 'enrich');

  const { content: template, hash } = loadPrompt('enrich_context');
  const prompt = template.replace('{{exam_name}}', job.examName);

  const webSearchTool: Anthropic.Tool = {
    type: 'web_search_20250305' as unknown as 'web_search_20250305',
    name: 'web_search',
    max_uses: job.maxWebSearches,
  } as unknown as Anthropic.Tool;

  const response = await trackedMessage({
    model: 'sonnet',
    messages: [{ role: 'user', content: prompt }],
    tools: [webSearchTool],
    jobId,
    pipelineStep: 'enrich',
    promptTemplateVersion: hash,
    webSearchesUsed: job.maxWebSearches,
  });

  const enrichContext = response.content
    .filter((b): b is TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  log.info({ jobId, contextLength: enrichContext.length }, 'enrich step complete');

  await db
    .update(generationJobs)
    .set({ progressPct: 25, enrichContext })
    .where(eq(generationJobs.id, jobId));
}
