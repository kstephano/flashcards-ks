import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { generationJobs, apiUsageLog } from '@/lib/db/schema';
import { eq, and, or, sum, gte } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const activeOnly = url.searchParams.get('active') === 'true';

  if (activeOnly) {
    const activeJob = await db.query.generationJobs.findFirst({
      where: and(
        eq(generationJobs.userId, session.user.id),
        or(
          eq(generationJobs.status, 'pending'),
          eq(generationJobs.status, 'running'),
          eq(generationJobs.status, 'awaiting_outline_approval'),
        ),
      ),
    });
    return NextResponse.json({ job: activeJob ?? null });
  }

  const jobs = await db.query.generationJobs.findMany({
    where: eq(generationJobs.userId, session.user.id),
    limit: 20,
  });
  return NextResponse.json(jobs);
}
