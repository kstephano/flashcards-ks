import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { generationJobs, userSettings } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  // Fetch user settings for dynamic thresholds
  const settings = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) });
  const spendCapUsd = Number(settings?.monthlySpendCapUsd ?? 50);

  // Run all queries in parallel
  const [
    monthlySpendResult,
    cardsGeneratedResult,
    reviewSessionsResult,
    cardsDueTodayResult,
    dailySpendResult,
    modelSpendResult,
    cacheHitRateResult,
    judgeScoresResult,
    scoreDistributionResult,
    regenRateResult,
    dropRateResult,
    reviewHeatmapResult,
    dueCardsForecastResult,
    retentionByDeckResult,
    recentJobs,
  ] = await Promise.all([
    // Monthly spend: sum cost_usd from api_usage_log joined to generation_jobs for this user, this month
    db.execute(sql`
      SELECT COALESCE(SUM(aul.cost_usd), 0) AS total_spend
      FROM api_usage_log aul
      JOIN generation_jobs gj ON aul.job_id = gj.id
      WHERE gj.user_id = ${userId}::uuid
        AND date_trunc('month', aul.timestamp) = date_trunc('month', now())
    `),

    // Cards generated this month
    db.execute(sql`
      SELECT COUNT(c.id) AS card_count
      FROM cards c
      JOIN decks d ON c.deck_id = d.id
      JOIN sections s ON d.section_id = s.id
      JOIN projects p ON s.project_id = p.id
      WHERE p.user_id = ${userId}::uuid
        AND c.created_at >= date_trunc('month', now())
    `),

    // Review sessions this month
    db.execute(sql`
      SELECT COUNT(id) AS session_count
      FROM review_sessions
      WHERE user_id = ${userId}::uuid
        AND started_at >= date_trunc('month', now())
    `),

    // Cards due today
    db.execute(sql`
      SELECT COUNT(c.id) AS due_count
      FROM cards c
      JOIN decks d ON c.deck_id = d.id
      JOIN sections s ON d.section_id = s.id
      JOIN projects p ON s.project_id = p.id
      WHERE p.user_id = ${userId}::uuid
        AND c.due_date <= now()
    `),

    // Daily spend last 30 days
    db.execute(sql`
      SELECT date_trunc('day', aul.timestamp)::date AS day,
             SUM(aul.cost_usd) AS total_usd
      FROM api_usage_log aul
      JOIN generation_jobs gj ON aul.job_id = gj.id -- only usage linked to jobs; unlinked rows (job_id IS NULL) are excluded
      WHERE gj.user_id = ${userId}::uuid
        AND aul.timestamp >= now() - INTERVAL '30 days'
      GROUP BY date_trunc('day', aul.timestamp)
      ORDER BY day
    `),

    // Model spend this month
    db.execute(sql`
      SELECT aul.model,
             SUM(aul.cost_usd) AS total_usd
      FROM api_usage_log aul
      JOIN generation_jobs gj ON aul.job_id = gj.id -- only usage linked to jobs; unlinked rows (job_id IS NULL) are excluded
      WHERE gj.user_id = ${userId}::uuid
        AND date_trunc('month', aul.timestamp) = date_trunc('month', now())
      GROUP BY aul.model
      ORDER BY total_usd DESC
    `),

    // Cache hit rate (user-scoped, last 30 days)
    db.execute(sql`
      SELECT
        date_trunc('day', aul.timestamp)::date AS day,
        ROUND(100.0 * COUNT(*) FILTER (WHERE aul.cache_hit = true) / NULLIF(COUNT(*), 0), 1) AS hit_rate_pct,
        COUNT(*) AS total_calls
      FROM api_usage_log aul
      JOIN generation_jobs gj ON aul.job_id = gj.id
      WHERE gj.user_id = ${userId}::uuid
        AND aul.timestamp >= now() - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY 1
    `),

    // Judge scores by week, last 12 weeks
    db.execute(sql`
      SELECT date_trunc('week', c.created_at)::date AS week,
             AVG(c.accuracy_score) AS avg_accuracy,
             AVG(c.relevance_score) AS avg_relevance
      FROM cards c
      JOIN decks d ON c.deck_id = d.id
      JOIN sections s ON d.section_id = s.id
      JOIN projects p ON s.project_id = p.id
      WHERE p.user_id = ${userId}::uuid
        AND c.accuracy_score IS NOT NULL
        AND c.created_at >= now() - INTERVAL '12 weeks'
      GROUP BY date_trunc('week', c.created_at)
      ORDER BY week
    `),

    // Score distribution (accuracy_score 1-5)
    db.execute(sql`
      SELECT c.accuracy_score AS score,
             COUNT(c.id) AS count
      FROM cards c
      JOIN decks d ON c.deck_id = d.id
      JOIN sections s ON d.section_id = s.id
      JOIN projects p ON s.project_id = p.id
      WHERE p.user_id = ${userId}::uuid
        AND c.accuracy_score IS NOT NULL
      GROUP BY c.accuracy_score
      ORDER BY c.accuracy_score
    `),

    // Regen rate by week, last 12 weeks
    db.execute(sql`
      SELECT date_trunc('week', c.created_at)::date AS week,
             COUNT(*) FILTER (WHERE c.was_regenerated = true) AS regen_count,
             COUNT(*) AS total_count
      FROM cards c
      JOIN decks d ON c.deck_id = d.id
      JOIN sections s ON d.section_id = s.id
      JOIN projects p ON s.project_id = p.id
      WHERE p.user_id = ${userId}::uuid
        AND c.created_at >= now() - INTERVAL '12 weeks'
      GROUP BY date_trunc('week', c.created_at)
      ORDER BY week
    `),

    // Drop rate by week, last 12 weeks
    db.execute(sql`
      SELECT date_trunc('week', dc.created_at)::date AS week,
             COUNT(dc.id) AS drop_count
      FROM dropped_cards dc
      JOIN decks d ON dc.deck_id = d.id
      JOIN sections s ON d.section_id = s.id
      JOIN projects p ON s.project_id = p.id
      WHERE p.user_id = ${userId}::uuid
        AND dc.created_at >= now() - INTERVAL '12 weeks'
      GROUP BY date_trunc('week', dc.created_at)
      ORDER BY week
    `),

    // Review heatmap: review_events count per day, last 90 days
    db.execute(sql`
      SELECT re.reviewed_at::date AS date,
             COUNT(re.id) AS count
      FROM review_events re
      JOIN review_sessions rs ON re.session_id = rs.id
      WHERE rs.user_id = ${userId}::uuid
        AND re.reviewed_at >= now() - INTERVAL '90 days'
      GROUP BY re.reviewed_at::date
      ORDER BY date
    `),

    // Due cards forecast: next 30 days
    db.execute(sql`
      SELECT date_trunc('day', c.due_date)::date AS day,
             COUNT(c.id) AS count
      FROM cards c
      JOIN decks d ON c.deck_id = d.id
      JOIN sections s ON d.section_id = s.id
      JOIN projects p ON s.project_id = p.id
      WHERE p.user_id = ${userId}::uuid
        AND c.due_date >= now()
        AND c.due_date <= now() + INTERVAL '30 days'
      GROUP BY date_trunc('day', c.due_date)
      ORDER BY day
    `),

    // Retention by deck (total_cards = all cards in deck, retained = cards with last_review_quality >= 3)
    db.execute(sql`
      SELECT
        d.name AS deck_name,
        COUNT(c.id) AS total_cards,
        COUNT(c.id) FILTER (WHERE c.last_review_quality >= 3) AS retained_count
      FROM decks d
      JOIN sections s ON s.id = d.section_id
      JOIN projects p ON p.id = s.project_id
      LEFT JOIN cards c ON c.deck_id = d.id
      WHERE p.user_id = ${userId}::uuid
      GROUP BY d.id, d.name
    `),

    // Recent jobs (last 10)
    db.query.generationJobs.findMany({
      where: eq(generationJobs.userId, userId),
      orderBy: [desc(generationJobs.createdAt)],
      limit: 10,
    }),
  ]);

  // Extract scalar values
  const monthlySpendUsd = Number(
    (monthlySpendResult.rows[0] as Record<string, unknown>)?.total_spend ?? 0,
  );
  const cardsGeneratedThisMonth = Number(
    (cardsGeneratedResult.rows[0] as Record<string, unknown>)?.card_count ?? 0,
  );
  const reviewSessionsThisMonth = Number(
    (reviewSessionsResult.rows[0] as Record<string, unknown>)?.session_count ?? 0,
  );
  const cardsDueToday = Number(
    (cardsDueTodayResult.rows[0] as Record<string, unknown>)?.due_count ?? 0,
  );

  // Daily spend
  const dailySpend = dailySpendResult.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      day: String(r.day),
      totalUsd: Number(r.total_usd ?? 0),
    };
  });

  // Model spend
  const modelSpend = modelSpendResult.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      model: String(r.model ?? ''),
      totalUsd: Number(r.total_usd ?? 0),
    };
  });

  // Cache hit rate
  const cacheHitRate = cacheHitRateResult.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      day: String(r.day ?? ''),
      hitRatePct: Number(r.hit_rate_pct ?? 0),
      totalCalls: Number(r.total_calls ?? 0),
    };
  });

  // Judge scores
  const judgeScores = judgeScoresResult.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      week: String(r.week),
      avgAccuracy: Number(r.avg_accuracy ?? 0),
      avgRelevance: Number(r.avg_relevance ?? 0),
    };
  });

  // Score distribution
  const scoreDistribution = scoreDistributionResult.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      score: Number(r.score ?? 0),
      count: Number(r.count ?? 0),
    };
  });

  // Regen rate
  const regenRate = regenRateResult.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      week: String(r.week),
      regenCount: Number(r.regen_count ?? 0),
      totalCount: Number(r.total_count ?? 0),
    };
  });

  // Drop rate
  const dropRate = dropRateResult.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      week: String(r.week),
      dropCount: Number(r.drop_count ?? 0),
    };
  });

  // Review heatmap
  const reviewHeatmap = reviewHeatmapResult.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      date: String(r.date),
      count: Number(r.count ?? 0),
    };
  });

  // Due cards forecast
  const dueCardsForecast = dueCardsForecastResult.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      day: String(r.day),
      count: Number(r.count ?? 0),
    };
  });

  // Retention by deck
  const retentionByDeck = retentionByDeckResult.rows.map((row) => {
    const r = row as Record<string, unknown>;
    const totalCards = Number(r.total_cards ?? 0);
    const retainedCount = Number(r.retained_count ?? 0);
    const retentionPct = totalCards > 0 ? Math.round((retainedCount / totalCards) * 100) : 0;
    return {
      deckName: String(r.deck_name ?? ''),
      retentionPct,
      totalCards,
    };
  });

  // Compute area insights server-side
  const areaInsights: string[] = [];

  // Low retention decks
  for (const deck of retentionByDeck) {
    if (deck.retentionPct < 50) {
      areaInsights.push(
        `Deck '${deck.deckName}' has low retention (${deck.retentionPct}%) — consider reviewing it more frequently.`,
      );
    }
  }

  // High regen rate (overall)
  const totalCards = regenRate.reduce((sum, w) => sum + w.totalCount, 0);
  const totalRegen = regenRate.reduce((sum, w) => sum + w.regenCount, 0);
  if (totalCards > 0) {
    const regenPct = Math.round((totalRegen / totalCards) * 100);
    if (regenPct > 20) {
      areaInsights.push(
        `High card regeneration rate (${regenPct}%) — consider adjusting your prompts.`,
      );
    }
  }

  // Cards due today
  if (cardsDueToday > 20) {
    areaInsights.push(
      `You have ${cardsDueToday} cards due today — start a study session!`,
    );
  }

  // Monthly spend approaching cap (warn at 80% of user's monthly spend cap)
  if (monthlySpendUsd > spendCapUsd * 0.8) {
    areaInsights.push(
      `Monthly spend is $${monthlySpendUsd.toFixed(2)} — approaching your cap.`,
    );
  }

  // Recent jobs
  const recentJobsFormatted = recentJobs.map((job) => ({
    id: job.id,
    status: job.status,
    currentStep: job.currentStep ?? null,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    actualCostUsd: job.actualCostUsd ?? null,
  }));

  return NextResponse.json({
    monthlySpendUsd,
    cardsGeneratedThisMonth,
    reviewSessionsThisMonth,
    cardsDueToday,
    dailySpend,
    modelSpend,
    cacheHitRate,
    judgeScores,
    scoreDistribution,
    regenRate,
    dropRate,
    reviewHeatmap,
    dueCardsForecast,
    retentionByDeck,
    areaInsights,
    recentJobs: recentJobsFormatted,
  });
}
