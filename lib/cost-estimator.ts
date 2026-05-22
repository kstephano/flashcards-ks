import { PRICING } from './pricing';

export interface EstimateInput {
  pageCount: number;
  sectionCount: number;
  requestedCardCount: number | null;
  maxWebSearches: number;
}

export interface CostBreakdown {
  sonnetLow: number;
  sonnetHigh: number;
  opusLow: number;
  opusHigh: number;
  searchCost: number;
  totalLow: number;
  totalHigh: number;
}

const PDF_TOKENS_PER_PAGE = 2000;
const REGEN_LOW = 1.10;
const REGEN_HIGH = 1.35;

export function estimateCost(input: EstimateInput): CostBreakdown {
  const { pageCount, sectionCount, requestedCardCount, maxWebSearches } = input;
  const totalCards = requestedCardCount ?? sectionCount * 20;
  const cardsPerSection = totalCards / sectionCount;

  // Sonnet token estimates
  const structureIn = pageCount * PDF_TOKENS_PER_PAGE;
  const structureOut = 1000;
  const enrichIn = 1000 + maxWebSearches * 500;
  const enrichOut = 2000;
  const generateIn = sectionCount * ((pageCount / sectionCount) * PDF_TOKENS_PER_PAGE + 1500);
  const generateOut = sectionCount * cardsPerSection * 300;

  // Opus token estimates (judge calls)
  const judgeIn = totalCards * 1000;
  const judgeOut = totalCards * 250;

  const sonnetBase =
    ((structureIn + enrichIn + generateIn) / 1_000_000) * PRICING.sonnet.inputPerMTok +
    ((structureOut + enrichOut + generateOut) / 1_000_000) * PRICING.sonnet.outputPerMTok;

  const opusBase =
    (judgeIn / 1_000_000) * PRICING.opus.inputPerMTok +
    (judgeOut / 1_000_000) * PRICING.opus.outputPerMTok;

  const searchCost = maxWebSearches * PRICING.webSearchPerCall;
  const base = sonnetBase + opusBase + searchCost;

  return {
    sonnetLow: sonnetBase * REGEN_LOW,
    sonnetHigh: sonnetBase * REGEN_HIGH,
    opusLow: opusBase * REGEN_LOW,
    opusHigh: opusBase * REGEN_HIGH,
    searchCost,
    totalLow: base * REGEN_LOW,
    totalHigh: base * REGEN_HIGH,
  };
}
