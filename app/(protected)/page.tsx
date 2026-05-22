import { auth } from '@/auth';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';

export default async function ProjectsPage() {
  const session = await auth();
  const projectList = await db.query.projects.findMany({
    where: eq(projects.userId, session!.user!.id!),
    orderBy: desc(projects.createdAt),
  });

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Projects</h1>
        <CreateProjectDialog />
      </div>
      {projectList.length === 0 ? (
        <p className="text-muted-foreground">No projects yet. Create one to get started.</p>
      ) : (
        <div className="grid gap-4">
          {projectList.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="block rounded-lg border p-4 hover:bg-muted/50 transition-colors">
              <div className="font-medium">{p.name}</div>
              {p.description && <div className="text-sm text-muted-foreground mt-1">{p.description}</div>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
