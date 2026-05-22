import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { generationJobs, sectionGenerationStatus } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  const job = await db.query.generationJobs.findFirst({
    where: and(
      eq(generationJobs.id, id),
      eq(generationJobs.userId, session.user.id),
    ),
  });
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const sections = await db.query.sectionGenerationStatus.findMany({
    where: eq(sectionGenerationStatus.jobId, id),
  });

  return NextResponse.json({ job, sections });
}
