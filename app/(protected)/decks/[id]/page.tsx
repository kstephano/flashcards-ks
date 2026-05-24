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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <nav className="text-sm text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">Projects</Link>
            <span className="mx-1.5">/</span>
            <Link href={`/projects/${project.id}`} className="hover:text-foreground transition-colors">{project.name}</Link>
            <span className="mx-1.5">/</span>
            <Link href={`/projects/${project.id}/sections/${section.id}`} className="hover:text-foreground transition-colors">{section.name}</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground font-medium">{deck.name}</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight">{deck.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{cardList.length} cards</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link href={`/decks/${id}/study`}>
            <Button className="h-11 px-5 font-semibold">Study</Button>
          </Link>
          <a href={`/api/export/${id}`}>
            <Button variant="outline" className="h-11 px-5 font-semibold">Export to Anki</Button>
          </a>
        </div>
      </div>

      {/* Card table — horizontally scrollable on mobile */}
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <CardTable cards={cardList} />
      </div>
    </div>
  );
}
