import { auth } from '@/auth';
import { db } from '@/lib/db';
import { decks, sections, projects, cards } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CardTable } from '@/components/cards/CardTable';

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  const deck = await db.query.decks.findFirst({ where: eq(decks.id, id) });
  if (!deck) notFound();
  const section = await db.query.sections.findFirst({ where: eq(sections.id, deck.sectionId) });
  if (!section) notFound();
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, section.projectId), eq(projects.userId, session!.user!.id!)) });
  if (!project) notFound();
  const cardList = await db.query.cards.findMany({ where: eq(cards.deckId, id), orderBy: asc(cards.createdAt) });

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/projects/${project.id}/sections/${section.id}`} className="hover:underline">{section.name}</Link> / {deck.name}
          </p>
          <h1 className="text-2xl font-bold mt-1">{deck.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{cardList.length} cards</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/decks/${id}/study`}><Button variant="default">Study</Button></Link>
          <a href={`/api/export/${id}`}><Button variant="outline">Export to Anki</Button></a>
        </div>
      </div>
      <CardTable cards={cardList} />
    </div>
  );
}
