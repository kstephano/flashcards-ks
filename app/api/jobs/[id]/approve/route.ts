import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { generationJobs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

interface SectionOutlineItem {
  name: string;
  page_start: number;
  page_end: number;
  description?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json()) as { outline: SectionOutlineItem[] };

  const job = await db.query.generationJobs.findFirst({
    where: and(
      eq(generationJobs.id, id),
      eq(generationJobs.userId, session.user.id),
    ),
    columns: { status: true },
  });
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (job.status !== 'awaiting_outline_approval') {
    return NextResponse.json({ error: 'Job is not awaiting outline approval' }, { status: 409 });
  }

  await db
    .update(generationJobs)
    .set({
      pendingSectionOutline: body.outline,
      outlineApprovedAt: new Date(),
    })
    .where(eq(generationJobs.id, id));

  return NextResponse.json({ ok: true });
}
