import type { CostBreakdown } from '@/lib/cost-estimator';

interface Props {
  estimate: CostBreakdown;
  monthlyCapUsd?: number;
  currentMonthSpendUsd?: number;
}

export function CostEstimateDisplay({ estimate, monthlyCapUsd = 50, currentMonthSpendUsd = 0 }: Props) {
  const fmt = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="rounded-lg border p-4 space-y-3 text-sm">
      <div className="font-medium">Estimated cost</div>
      <div className="space-y-1.5 text-muted-foreground">
        <div className="flex justify-between">
          <span>Generation (Sonnet)</span>
          <span>{fmt(estimate.sonnetLow)} – {fmt(estimate.sonnetHigh)}</span>
        </div>
        <div className="flex justify-between">
          <span>Judging (Opus)</span>
          <span>{fmt(estimate.opusLow)} – {fmt(estimate.opusHigh)}</span>
        </div>
        <div className="flex justify-between">
          <span>Web search</span>
          <span>{fmt(estimate.searchCost)}</span>
        </div>
        <div className="flex justify-between">
          <span>Cache lookup</span>
          <span className="text-green-600">Free</span>
        </div>
      </div>
      <div className="border-t pt-2 flex justify-between font-medium">
        <span>Total estimate</span>
        <span>{fmt(estimate.totalLow)} – {fmt(estimate.totalHigh)}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Your monthly cap: ${monthlyCapUsd} (currently used: ${currentMonthSpendUsd.toFixed(2)})
      </div>
    </div>
  );
}
