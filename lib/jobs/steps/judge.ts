import { trackedMessage } from '@/lib/anthropic/client';
import { judgeCardTool } from '@/lib/anthropic/tools';
import { loadPrompt } from '@/lib/prompt-loader';
import type { RawCard } from './generate';
import pino from 'pino';

const log = pino();

export interface JudgedCard extends RawCard {
  accuracyScore: number;
  relevanceScore: number;
  judgeRationale: string;
  needsRegeneration: boolean;
}

export async function judgeCard(
  card: RawCard,
  examName: string | null,
  jobId: string,
  sectionId?: string,
): Promise<JudgedCard> {
  const { content: promptTemplate, hash } = loadPrompt('judge_card');
  const prompt = promptTemplate
    .replace('{{front}}', card.front)
    .replace('{{back}}', card.back)
    .replace('{{source_quote}}', card.source_quote)
    .replace('{{exam_name}}', examName ?? 'Not specified (score on general educational value)');

  const response = await trackedMessage({
    model: 'opus',
    messages: [{ role: 'user', content: prompt }],
    tools: [judgeCardTool],
    tool_choice: { type: 'tool', name: 'judge_card' },
    jobId,
    sectionId,
    pipelineStep: 'judge',
    promptTemplateVersion: hash,
    maxTokens: 1024,
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Judge step: Claude did not call the judge_card tool');
  }

  const input = toolUse.input as {
    accuracy_score: number;
    relevance_score: number;
    rationale: string;
  };

  const needsRegeneration = input.accuracy_score < 3 || input.relevance_score < 3;

  log.debug(
    { jobId, front: card.front.slice(0, 50), accuracy: input.accuracy_score, relevance: input.relevance_score },
    'card judged',
  );

  return {
    ...card,
    accuracyScore: input.accuracy_score,
    relevanceScore: input.relevance_score,
    judgeRationale: input.rationale,
    needsRegeneration,
  };
}

export async function runJudgeStep(
  cards: RawCard[],
  examName: string | null,
  jobId: string,
): Promise<JudgedCard[]> {
  log.info({ jobId, cardCount: cards.length }, 'judge step starting');
  const results: JudgedCard[] = [];

  for (const card of cards) {
    const judged = await judgeCard(card, examName, jobId);
    results.push(judged);
  }

  const passing = results.filter((c) => !c.needsRegeneration).length;
  const failing = results.length - passing;
  log.info({ jobId, passing, failing }, 'judge step complete');

  return results;
}
