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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header with breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="text-sm text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">Projects</Link>
            <span className="mx-1.5">/</span>
            <Link href={`/projects/${id}`} className="hover:text-foreground transition-colors">{project.name}</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground font-medium">{section.name}</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight">{section.name}</h1>
        </div>
        <UploadModal sectionId={sid}>
          <Button className="h-11 px-5 font-semibold">Generate Flashcards</Button>
        </UploadModal>
      </div>

      {/* Content */}
      {deckList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 px-6 text-center space-y-4">
          <div className="text-5xl">🃏</div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">No decks yet</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Upload a PDF to generate flashcards for this section.
            </p>
          </div>
          <UploadModal sectionId={sid}>
            <Button className="h-11 px-5 font-semibold">Generate Flashcards</Button>
          </UploadModal>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {deckList.map(d => (
            <Link
              key={d.id}
              href={`/decks/${d.id}`}
              className="group rounded-xl border bg-card p-5 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate group-hover:text-primary transition-colors">
                    {d.name}
                  </div>
                  {d.examName && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Exam: {d.examName}
                    </div>
                  )}
                </div>
                <span className="text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 mt-0.5">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
