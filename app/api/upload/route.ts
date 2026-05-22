import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { validatePdf } from '@/lib/pdf/validate';
import { sha256 } from '@/lib/pdf/hash';
import { uploadPdf } from '@/lib/pdf/storage';
import { db } from '@/lib/db';
import { sourcePdfs, generationJobs, generationCache, userSettings } from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { estimateCost } from '@/lib/cost-estimator';
import { buildCacheKey } from '@/lib/cache/generation-cache';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const sectionId = formData.get('sectionId') as string | null;
  const examName = (formData.get('examName') as string | null) || null;
  const requestedCardCount = formData.get('requestedCardCount')
    ? Number(formData.get('requestedCardCount'))
    : null;
  const maxWebSearches = formData.get('maxWebSearches')
    ? Number(formData.get('maxWebSearches'))
    : 3;

  if (!file || !sectionId) {
    return NextResponse.json({ error: 'Missing file or sectionId' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let pageCount: number;
  try {
    ({ pageCount } = await validatePdf(buffer));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Invalid PDF';
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const hash = sha256(buffer);

  // Block if user already has an active job
  const activeJob = await db.query.generationJobs.findFirst({
    where: and(
      eq(generationJobs.userId, userId),
      or(
        eq(generationJobs.status, 'pending'),
        eq(generationJobs.status, 'running'),
        eq(generationJobs.status, 'awaiting_outline_approval'),
      ),
    ),
  });
  if (activeJob) {
    return NextResponse.json(
      { error: 'A generation job is already in progress. Wait for it to complete before starting another.' },
      { status: 409 },
    );
  }

  // Check spend cap
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });
  const spendCap = Number(settings?.monthlySpendCapUsd ?? 50);

  // Estimate cost (use placeholder sectionCount=5 — real count comes from outline step)
  const estimate = estimateCost({
    pageCount,
    sectionCount: 5,
    requestedCardCount,
    maxWebSearches,
  });

  if (estimate.totalHigh > spendCap) {
    return NextResponse.json(
      { error: `Estimated cost ($${estimate.totalHigh.toFixed(2)}) exceeds your monthly cap ($${spendCap}).` },
      { status: 402 },
    );
  }

  // Check generation cache
  const cacheKey = buildCacheKey({ pdfHash: hash, examName, requestedCardCount, maxWebSearches });
  const cached = await db.query.generationCache.findFirst({
    where: eq(generationCache.cacheKey, cacheKey),
  });
  if (cached) {
    // Cache hit — return the cached deck info without creating a job
    return NextResponse.json({ cacheHit: true, cacheKey, estimate });
  }

  // Upload PDF to Supabase Storage if not already uploaded
  let pdfRecord = await db.query.sourcePdfs.findFirst({
    where: eq(sourcePdfs.sha256Hash, hash),
  });
  if (!pdfRecord) {
    const storagePath = await uploadPdf(userId, hash, buffer);
    const inserted = await db
      .insert(sourcePdfs)
      .values({
        userId,
        filename: file.name,
        byteSize: buffer.length,
        pageCount,
        sha256Hash: hash,
        storagePath,
      })
      .returning();
    pdfRecord = inserted[0];
  }

  // Create the generation job
  const inserted = await db
    .insert(generationJobs)
    .values({
      userId,
      sourcePdfId: pdfRecord.id,
      targetSectionId: sectionId,
      examName,
      requestedCardCount,
      maxWebSearches,
      estimatedCostLowUsd: estimate.totalLow.toFixed(4),
      estimatedCostHighUsd: estimate.totalHigh.toFixed(4),
      status: 'pending',
    })
    .returning();
  const job = inserted[0];

  return NextResponse.json({ jobId: job.id, estimate });
}
