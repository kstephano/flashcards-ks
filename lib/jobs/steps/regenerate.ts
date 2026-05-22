import { trackedMessage } from '@/lib/anthropic/client';
import { generateCardsTool } from '@/lib/anthropic/tools';
import { loadPrompt } from '@/lib/prompt-loader';
import { judgeCard } from './judge';
import type { RawCard } from './generate';
import type { JudgedCard } from './judge';
import pino from 'pino';

const log = pino();

export interface DroppedCardData {
  attemptedFront: string;
  attemptedBack: string;
  finalAccuracyScore: number;
  finalRelevanceScore: number;
  finalRationale: string;
  attempts: number;
}

export interface RegenerateResult {
  accepted: JudgedCard[];
  dropped: DroppedCardData[];
}

/**
 * JudgedCard augmented with the wasRegenerated flag used by the persist step
 * to set the corresponding DB field on each card row.
 */
export interface ReGeneratedCard extends JudgedCard {
  wasRegenerated: boolean;
}

async function regenerateOne(
  original: JudgedCard,
  examName: string | null,
  jobId: string,
  signedUrl: string,
): Promise<RawCard | null> {
  const { content: template, hash } = loadPrompt('regenerate_card');
  const prompt = template
    .replace('{{original_front}}', original.front)
    .replace('{{original_back}}', original.back)
    .replace('{{judge_rationale}}', original.judgeRationale)
    .replace('{{section_name}}', original.sectionName)
    .replace('{{page_start}}', String(original.source_page))
    .replace('{{page_end}}', String(original.source_page));

  try {
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
      pipelineStep: 'regenerate',
      promptTemplateVersion: hash,
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') return null;

    const cards = (toolUse.input as { cards: RawCard[] }).cards;
    if (!cards.length) return null;

    return { ...cards[0], sectionName: original.sectionName };
  } catch (e) {
    log.warn({ jobId, error: e instanceof Error ? e.message : String(e) }, 'regeneration API call failed');
    return null;
  }
}

export async function runRegenerateStep(
  judgedCards: JudgedCard[],
  examName: string | null,
  jobId: string,
  signedUrl: string,
): Promise<RegenerateResult> {
  const passing = judgedCards.filter((c) => !c.needsRegeneration);
  const failing = judgedCards.filter((c) => c.needsRegeneration);

  log.info({ jobId, passing: passing.length, toRegenerate: failing.length }, 'regenerate step starting');

  const accepted: JudgedCard[] = [...passing];
  const dropped: DroppedCardData[] = [];

  for (const card of failing) {
    const regenerated = await regenerateOne(card, examName, jobId, signedUrl);

    if (!regenerated) {
      dropped.push({
        attemptedFront: card.front,
        attemptedBack: card.back,
        finalAccuracyScore: card.accuracyScore,
        finalRelevanceScore: card.relevanceScore,
        finalRationale: card.judgeRationale,
        attempts: 2,
      });
      continue;
    }

    // Re-judge the regenerated card with a fresh Opus call
    const reJudged = await judgeCard(regenerated, examName, jobId);

    if (reJudged.needsRegeneration) {
      log.info({ jobId, front: card.front.slice(0, 50) }, 'card dropped after re-judge');
      dropped.push({
        attemptedFront: regenerated.front,
        attemptedBack: regenerated.back,
        finalAccuracyScore: reJudged.accuracyScore,
        finalRelevanceScore: reJudged.relevanceScore,
        finalRationale: reJudged.judgeRationale,
        attempts: 2,
      });
    } else {
      // Cast to ReGeneratedCard — wasRegenerated is added here so the persist
      // step can set the corresponding DB column without touching JudgedCard's interface.
      const withFlag: ReGeneratedCard = { ...reJudged, wasRegenerated: true };
      accepted.push(withFlag as JudgedCard);
    }
  }

  log.info({ jobId, accepted: accepted.length, dropped: dropped.length }, 'regenerate step complete');
  return { accepted, dropped };
}
