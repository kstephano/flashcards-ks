import { createHash } from 'crypto';
import { getPromptVersionsHash } from '@/lib/prompt-loader';

export function buildCacheKey(params: {
  pdfHash: string;
  examName: string | null;
  requestedCardCount: number | null;
  maxWebSearches: number;
}): string {
  const versionsHash = getPromptVersionsHash();
  const input = [
    params.pdfHash,
    params.examName ?? '',
    String(params.requestedCardCount ?? ''),
    String(params.maxWebSearches),
    versionsHash,
  ].join('|');
  return createHash('sha256').update(input).digest('hex');
}
