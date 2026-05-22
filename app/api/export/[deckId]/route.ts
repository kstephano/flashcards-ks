import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { cards, decks, sections, projects } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { execFileSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest, { params }: { params: Promise<{ deckId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { deckId } = await params;
  const userId = session.user.id;

  // Fetch deck
  const deck = await db.query.decks.findFirst({ where: eq(decks.id, deckId) });
  if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 });

  // Ownership check: deck → section → project.userId === userId
  const section = await db.query.sections.findFirst({ where: eq(sections.id, deck.sectionId) });
  if (!section) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, section.projectId), eq(projects.userId, userId)),
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Fetch all cards for the deck
  const deckCards = await db.query.cards.findMany({ where: eq(cards.deckId, deckId) });

  // Build input JSON
  const input = {
    deck_name: deck.name,
    cards: deckCards.map((c) => ({
      card_type: c.cardType,
      front: c.front,
      back: c.back,
      explanation: c.explanation,
      source_page: c.sourcePage,
      source_quote: c.sourceQuote,
      tags: c.tags,
      exam_name: deck.examName,
      judge_rationale: c.judgeRationale,
    })),
  };

  const tmpId = randomUUID();
  const inputPath = join('/tmp', `deck-${tmpId}.json`);
  const outputPath = join('/tmp', `deck-${tmpId}.apkg`);

  writeFileSync(inputPath, JSON.stringify(input));

  try {
    execFileSync('python3', ['scripts/export_anki.py', inputPath, outputPath]);
  } catch {
    if (existsSync(inputPath)) unlinkSync(inputPath);
    if (existsSync(outputPath)) unlinkSync(outputPath);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }

  const apkg = readFileSync(outputPath);
  unlinkSync(inputPath);
  unlinkSync(outputPath);

  return new NextResponse(apkg, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${deck.name.replace(/[^a-z0-9]/gi, '_')}.apkg"`,
    },
  });
}
