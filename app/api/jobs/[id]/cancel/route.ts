import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { generationJobs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(
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
    columns: { status: true },
  });
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!['pending', 'running', 'awaiting_outline_approval'].includes(job.status)) {
    return NextResponse.json({ error: 'Job cannot be cancelled in its current state' }, { status: 409 });
  }

  await db
    .update(generationJobs)
    .set({ status: 'cancelled' })
    .where(eq(generationJobs.id, id));

  return NextResponse.json({ ok: true });
}
