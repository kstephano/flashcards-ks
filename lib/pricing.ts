export const PRICING = {
  sonnet: {
    inputPerMTok: 3.00,
    outputPerMTok: 15.00,
    cacheReadPerMTok: 0.30,
  },
  opus: {
    inputPerMTok: 5.00,
    outputPerMTok: 25.00,
    cacheReadPerMTok: 0.50,
  },
  webSearchPerCall: 0.01,
} as const;

export function computeTokenCost(
  model: 'sonnet' | 'opus',
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
): number {
  const p = PRICING[model];
  return (
    (inputTokens / 1_000_000) * p.inputPerMTok +
    (outputTokens / 1_000_000) * p.outputPerMTok +
    (cacheReadTokens / 1_000_000) * p.cacheReadPerMTok
  );
}
