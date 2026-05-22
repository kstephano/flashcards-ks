export interface FlashCard {
  id: string;
  cardType: string;
  front: string;
  back: string;
  explanation: string | null;
  sourcePage: number | null;
  sourceQuote: string | null;
  difficulty: number | null;
  accuracyScore: number | null;
  relevanceScore: number | null;
  humanEdited: boolean;
  tags: string[] | null;
  [key: string]: unknown;
}
