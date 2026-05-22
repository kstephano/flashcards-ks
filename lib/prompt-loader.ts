import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';

const PROMPT_FILES = [
  'extract_structure',
  'enrich_context',
  'generate_cards',
  'regenerate_card',
  'judge_card',
] as const;

type PromptName = (typeof PROMPT_FILES)[number];

const cache = new Map<PromptName, { content: string; hash: string }>();

export function loadPrompt(name: PromptName): { content: string; hash: string } {
  if (cache.has(name)) return cache.get(name)!;
  const content = readFileSync(
    resolve(process.cwd(), `prompts/${name}.md`),
    'utf-8',
  );
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
  const entry = { content, hash };
  cache.set(name, entry);
  return entry;
}

export function getPromptVersionsHash(): string {
  const hashes = PROMPT_FILES.map((name) => loadPrompt(name).hash).join(':');
  return createHash('sha256').update(hashes).digest('hex').slice(0, 16);
}
