'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SpendBarChart } from '@/components/dashboard/SpendBarChart';
import { ModelSpendChart } from '@/components/dashboard/ModelSpendChart';
import { CacheHitChart } from '@/components/dashboard/CacheHitChart';
import { JudgeScoreChart } from '@/components/dashboard/JudgeScoreChart';
import { ScoreHistogram } from '@/components/dashboard/ScoreHistogram';
import { RegenRateChart } from '@/components/dashboard/RegenRateChart';
import { ReviewHeatmap } from '@/components/dashboard/ReviewHeatmap';
import { DueCardsChart } from '@/components/dashboard/DueCardsChart';
import { RetentionChart } from '@/components/dashboard/RetentionChart';
import { AreaInsights } from '@/components/dashboard/AreaInsights';
import { PipelineHealthTable } from '@/components/dashboard/PipelineHealthTable';

interface DashboardData {
  monthlySpendUsd: number;
  cardsGeneratedThisMonth: number;
  reviewSessionsThisMonth: number;
  cardsDueToday: number;
  dailySpend: { day: string; totalUsd: number }[];
  modelSpend: { model: string; totalUsd: number }[];
  cacheHitRate: { day: string; hitRatePct: number; totalCalls: number }[];
  judgeScores: { week: string; avgAccuracy: number; avgRelevance: number }[];
  scoreDistribution: { score: number; count: number }[];
  regenRate: { week: string; regenCount: number; totalCount: number }[];
  dropRate: { week: string; dropCount: number }[];
  reviewHeatmap: { date: string; count: number }[];
  dueCardsForecast: { day: string; count: number }[];
  retentionByDeck: { deckName: string; retentionPct: number; totalCards: number }[];
  areaInsights: string[];
  recentJobs: {
    id: string;
    status: string;
    currentStep: string | null;
    createdAt: string;
    completedAt: string | null;
    actualCostUsd: string | null;
  }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/dashboard', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        return res.json() as Promise<DashboardData>;
      })
      .then((d) => {
        setData(d);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-destructive text-sm">
          Failed to load dashboard: {error ?? 'Unknown error'}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
              Monthly Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ${data.monthlySpendUsd.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
              Cards Generated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.cardsGeneratedThisMonth}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
              Study Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.reviewSessionsThisMonth}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
              Cards Due Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.cardsDueToday}</p>
          </CardContent>
        </Card>
      </div>

      {/* Area Insights */}
      {data.areaInsights && data.areaInsights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Area Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <AreaInsights insights={data.areaInsights} />
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="space-y-6">
        {/* Daily Spend */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Spend (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <SpendBarChart data={data.dailySpend} />
          </CardContent>
        </Card>

        {/* Spend by Model */}
        <Card>
          <CardHeader>
            <CardTitle>Spend by Model</CardTitle>
          </CardHeader>
          <CardContent>
            <ModelSpendChart data={data.modelSpend} />
          </CardContent>
        </Card>

        {/* Cache Hit Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Cache Hit Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <CacheHitChart data={data.cacheHitRate} />
          </CardContent>
        </Card>

        {/* Judge Scores */}
        <Card>
          <CardHeader>
            <CardTitle>Judge Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <JudgeScoreChart data={data.judgeScores} />
          </CardContent>
        </Card>

        {/* Score Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreHistogram data={data.scoreDistribution} />
          </CardContent>
        </Card>

        {/* Regen Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Regen Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <RegenRateChart data={data.regenRate} />
          </CardContent>
        </Card>

        {/* Review Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle>Review Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <ReviewHeatmap data={data.reviewHeatmap} />
          </CardContent>
        </Card>

        {/* Due Cards Forecast */}
        <Card>
          <CardHeader>
            <CardTitle>Due Cards Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <DueCardsChart data={data.dueCardsForecast} />
          </CardContent>
        </Card>

        {/* Retention by Deck */}
        <Card>
          <CardHeader>
            <CardTitle>Retention by Deck</CardTitle>
          </CardHeader>
          <CardContent>
            <RetentionChart data={data.retentionByDeck} />
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Health */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Health</CardTitle>
        </CardHeader>
        <CardContent>
          <PipelineHealthTable jobs={data.recentJobs} />
        </CardContent>
      </Card>
    </div>
  );
}
