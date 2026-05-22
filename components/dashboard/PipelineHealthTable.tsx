'use client';

interface Job {
  id: string;
  status: string;
  currentStep: string | null;
  createdAt: string;
  completedAt: string | null;
  actualCostUsd: string | null;
}

interface Props {
  jobs: Job[];
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'complete':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'running':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function PipelineHealthTable({ jobs }: Props) {
  if (!jobs || jobs.length === 0) {
    return <p className="text-muted-foreground text-sm">No data yet</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 pr-4 font-medium">Job ID</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 pr-4 font-medium">Step</th>
            <th className="pb-2 pr-4 font-medium">Created</th>
            <th className="pb-2 pr-4 font-medium">Completed</th>
            <th className="pb-2 font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-b last:border-0">
              <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                …{job.id.slice(-8)}
              </td>
              <td className="py-2 pr-4">
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(job.status)}`}
                >
                  {job.status}
                </span>
              </td>
              <td className="py-2 pr-4 text-xs">
                {job.currentStep ?? '—'}
              </td>
              <td className="py-2 pr-4 text-xs text-muted-foreground">
                {new Date(job.createdAt).toLocaleString()}
              </td>
              <td className="py-2 pr-4 text-xs text-muted-foreground">
                {job.completedAt ? new Date(job.completedAt).toLocaleString() : '—'}
              </td>
              <td className="py-2 text-xs">
                {job.actualCostUsd != null ? `$${parseFloat(job.actualCostUsd).toFixed(4)}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
