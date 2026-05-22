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
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground"><Link href="/" className="hover:underline">Projects</Link> / {project.name}</p>
          <h1 className="text-2xl font-bold mt-1">{project.name}</h1>
        </div>
        <CreateSectionDialog projectId={id} />
      </div>
      {sectionList.length === 0 ? (
        <p className="text-muted-foreground">No sections yet. Create a section to organise your decks.</p>
      ) : (
        <div className="grid gap-3">
          {sectionList.map(s => (
            <Link key={s.id} href={`/projects/${id}/sections/${s.id}`} className="block rounded-lg border p-4 hover:bg-muted/50 transition-colors">
              <div className="font-medium">{s.name}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
