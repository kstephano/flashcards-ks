import { auth } from '@/auth';
import { db } from '@/lib/db';
import { projects, sections, decks } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { UploadModal } from '@/components/decks/UploadModal';

export default async function SectionPage({ params }: { params: Promise<{ id: string; sid: string }> }) {
  const session = await auth();
  const { id, sid } = await params;
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, id), eq(projects.userId, session!.user!.id!)) });
  if (!project) notFound();
  const section = await db.query.sections.findFirst({ where: and(eq(sections.id, sid), eq(sections.projectId, id)) });
  if (!section) notFound();
  const deckList = await db.query.decks.findMany({ where: eq(decks.sectionId, sid), orderBy: desc(decks.createdAt) });

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="hover:underline">Projects</Link> / <Link href={`/projects/${id}`} className="hover:underline">{project.name}</Link> / {section.name}
          </p>
          <h1 className="text-2xl font-bold mt-1">{section.name}</h1>
        </div>
        <UploadModal sectionId={sid}>
          <Button>Generate Flashcards</Button>
        </UploadModal>
      </div>
      {deckList.length === 0 ? (
        <p className="text-muted-foreground">No decks yet. Upload a PDF to generate flashcards.</p>
      ) : (
        <div className="grid gap-3">
          {deckList.map(d => (
            <Link key={d.id} href={`/decks/${d.id}`} className="block rounded-lg border p-4 hover:bg-muted/50 transition-colors">
              <div className="font-medium">{d.name}</div>
              {d.examName && <div className="text-xs text-muted-foreground mt-1">Exam: {d.examName}</div>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
