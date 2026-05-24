import { auth } from '@/auth';
import { db } from '@/lib/db';
import { projects, sections } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { CreateSectionDialog } from '@/components/sections/CreateSectionDialog';
import Link from 'next/link';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  const project = await db.query.projects.findFirst({ where: and(eq(projects.id, id), eq(projects.userId, session!.user!.id!)) });
  if (!project) notFound();
  const sectionList = await db.query.sections.findMany({ where: eq(sections.projectId, id), orderBy: asc(sections.orderIndex) });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header with breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="text-sm text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">Projects</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground font-medium">{project.name}</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
        </div>
        <CreateSectionDialog projectId={id} />
      </div>

      {/* Content */}
      {sectionList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 px-6 text-center space-y-4">
          <div className="text-5xl">📂</div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">No sections yet</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Create a section to organise your decks within this project.
            </p>
          </div>
          <CreateSectionDialog projectId={id} />
        </div>
      ) : (
        <div className="space-y-3">
          {sectionList.map(s => (
            <Link
              key={s.id}
              href={`/projects/${id}/sections/${s.id}`}
              className="group flex items-center justify-between rounded-xl border bg-card p-5 hover:shadow-md transition-shadow cursor-pointer"
            >
              <span className="font-medium group-hover:text-primary transition-colors">
                {s.name}
              </span>
              <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
