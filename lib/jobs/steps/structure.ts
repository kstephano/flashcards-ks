import { db } from '@/lib/db';
import { generationJobs, sourcePdfs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { trackedMessage } from '@/lib/anthropic/client';
import { structureTool } from '@/lib/anthropic/tools';
import { loadPrompt } from '@/lib/prompt-loader';
import { getSignedUrl } from '@/lib/pdf/storage';
import { updateJobProgress } from '@/lib/jobs/queue';
import type Anthropic from '@anthropic-ai/sdk';
import pino from 'pino';

const log = pino();

export interface SectionOutlineItem {
  name: string;
  page_start: number;
  page_end: number;
  description?: string;
}

export async function runStructureStep(jobId: string): Promise<void> {
  const job = await db.query.generationJobs.findFirst({
    where: eq(generationJobs.id, jobId),
  });
  if (!job) throw new Error(`Job ${jobId} not found`);

  const pdfRecord = await db.query.sourcePdfs.findFirst({
    where: eq(sourcePdfs.id, job.sourcePdfId),
  });
  if (!pdfRecord) throw new Error(`Source PDF not found for job ${jobId}`);

  await updateJobProgress(jobId, 5, 'structure');

  const { content: promptTemplate, hash: promptHash } = loadPrompt('extract_structure');
  const prompt = promptTemplate
    .replace('{{exam_name}}', job.examName ?? 'Not specified')
    .replace('{{page_count}}', String(pdfRecord.pageCount));

  const signedUrl = await getSignedUrl(pdfRecord.storagePath, 3600);

  const response = await trackedMessage({
    model: 'sonnet',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'url', url: signedUrl },
          },
          {
            type: 'text',
            text: prompt,
          },
        ] as unknown as Anthropic.MessageParam['content'],
      },
    ],
    tools: [structureTool],
    tool_choice: { type: 'tool', name: 'extract_structure' },
    jobId,
    pipelineStep: 'structure',
    promptTemplateVersion: promptHash,
  });

  const toolUseBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
    throw new Error('Structure step: Claude did not call the extract_structure tool');
  }

  const outline = (toolUseBlock.input as { sections: SectionOutlineItem[] }).sections;

  log.info({ jobId, sectionCount: outline.length }, 'structure step complete');

  await db
    .update(generationJobs)
    .set({
      pendingSectionOutline: outline,
      status: 'awaiting_outline_approval',
      progressPct: 15,
    })
    .where(eq(generationJobs.id, jobId));
}
