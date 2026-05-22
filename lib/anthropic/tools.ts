import type Anthropic from '@anthropic-ai/sdk';

export const structureTool: Anthropic.Tool = {
  name: 'extract_structure',
  description: 'Extract the section outline from the PDF document.',
  input_schema: {
    type: 'object',
    properties: {
      sections: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Section title' },
            page_start: { type: 'integer', description: 'First page of this section (1-indexed)' },
            page_end: { type: 'integer', description: 'Last page of this section (1-indexed)' },
            description: { type: 'string', description: 'Brief description of section content' },
          },
          required: ['name', 'page_start', 'page_end'],
        },
      },
    },
    required: ['sections'],
  },
};

export const generateCardsTool: Anthropic.Tool = {
  name: 'generate_cards',
  description: 'Generate flashcards from the specified section of the PDF.',
  input_schema: {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            card_type: {
              type: 'string',
              enum: ['qa', 'cloze', 'multiple_choice'],
              description: 'Type of flashcard',
            },
            front: {
              type: 'string',
              description: 'Front of card. For cloze: use {{c1::hidden}} syntax. For MC: question + A-D options.',
            },
            back: {
              type: 'string',
              description: 'Back of card. For cloze: full unhidden text. For MC: correct letter + justification.',
            },
            explanation: {
              type: 'string',
              description: 'Optional extended explanation shown after answer',
            },
            source_page: {
              type: 'integer',
              description: 'Page number in the PDF where this content appears',
            },
            source_quote: {
              type: 'string',
              description: 'Verbatim quote from the PDF (max 200 characters) that grounds this card',
            },
            difficulty: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              description: '1=trivial recall, 5=requires synthesis',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 3,
              description: '1-3 topic tags',
            },
          },
          required: ['card_type', 'front', 'back', 'source_page', 'source_quote', 'difficulty', 'tags'],
        },
      },
    },
    required: ['cards'],
  },
};

export const judgeCardTool: Anthropic.Tool = {
  name: 'judge_card',
  description: 'Score a flashcard for accuracy and relevance against the source PDF.',
  input_schema: {
    type: 'object',
    properties: {
      accuracy_score: {
        type: 'integer',
        minimum: 1,
        maximum: 5,
        description: 'Factual accuracy against the source PDF (1=fabricated, 5=fully accurate)',
      },
      relevance_score: {
        type: 'integer',
        minimum: 1,
        maximum: 5,
        description: 'Usefulness for the specified exam (1=irrelevant, 5=highly relevant)',
      },
      rationale: {
        type: 'string',
        description: 'Explanation of scores, used to guide regeneration if card is rejected',
      },
    },
    required: ['accuracy_score', 'relevance_score', 'rationale'],
  },
};
