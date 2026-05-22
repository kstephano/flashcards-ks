import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/lib/db';
import { apiUsageLog } from '@/lib/db/schema';
import { computeTokenCost } from '@/lib/pricing';
import pino from 'pino';

const log = pino();

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type PipelineStep = 'structure' | 'enrich' | 'generate' | 'judge' | 'regenerate' | 'persist';

interface TrackedMessageParams {
  model: 'sonnet' | 'opus';
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  tool_choice?: Anthropic.ToolChoiceAuto | Anthropic.ToolChoiceTool | Anthropic.ToolChoiceAny;
  jobId?: string;
  sectionId?: string;
  pipelineStep: PipelineStep;
  promptTemplateVersion?: string;
  webSearchesUsed?: number;
  maxTokens?: number;
}

export async function trackedMessage(params: TrackedMessageParams): Promise<Anthropic.Message> {
  const modelId =
    params.model === 'sonnet'
      ? (process.env.ANTHROPIC_SONNET_MODEL ?? 'claude-sonnet-4-6')
      : (process.env.ANTHROPIC_OPUS_MODEL ?? 'claude-opus-4-7');

  const start = Date.now();
  const response = await anthropic.messages.create({
    model: modelId,
    max_tokens: params.maxTokens ?? 8192,
    messages: params.messages,
    ...(params.tools ? { tools: params.tools } : {}),
    ...(params.tool_choice ? { tool_choice: params.tool_choice } : {}),
  });
  const latencyMs = Date.now() - start;

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const cacheReadTokens =
    (response.usage as unknown as Record<string, unknown>).cache_read_input_tokens as number ?? 0;
  const costUsd = computeTokenCost(params.model, inputTokens, outputTokens, cacheReadTokens);

  await db.insert(apiUsageLog).values({
    jobId: params.jobId ?? null,
    sectionId: params.sectionId ?? null,
    pipelineStep: params.pipelineStep,
    model: modelId,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    costUsd: costUsd.toFixed(6),
    latencyMs,
    cacheHit: false,
    promptTemplateVersion: params.promptTemplateVersion ?? null,
    webSearchesUsed: params.webSearchesUsed ?? 0,
  });

  log.info(
    { jobId: params.jobId, step: params.pipelineStep, model: params.model, costUsd, latencyMs },
    'api call logged',
  );

  return response;
}
