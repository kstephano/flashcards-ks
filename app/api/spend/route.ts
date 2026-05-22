import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const settings = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, session.user.id) });
  return NextResponse.json({
    currentMonthSpendUsd: 0,
    monthlyCapUsd: Number(settings?.monthlySpendCapUsd ?? 50),
  });
}
