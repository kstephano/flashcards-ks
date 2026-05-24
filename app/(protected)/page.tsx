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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your study materials</p>
        </div>
        <CreateProjectDialog />
      </div>

      {/* Content */}
      {projectList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 px-6 text-center space-y-4">
          <div className="text-5xl">📚</div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">No projects yet</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Create your first project to start organising your study materials and generating flashcards.
            </p>
          </div>
          <CreateProjectDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projectList.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group rounded-xl border bg-card p-5 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate group-hover:text-primary transition-colors">
                    {p.name}
                  </div>
                  {p.description && (
                    <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {p.description}
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
