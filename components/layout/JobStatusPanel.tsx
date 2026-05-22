'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Job {
  id: string;
  status: string;
  currentStep: string | null;
  progressPct: number;
}

export function JobStatusPanel() {
  const [job, setJob] = useState<Job | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs?active=true');
      if (!res.ok) return;
      const data = await res.json() as { job: Job | null };
      setJob(data.job);
    } catch {}
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [poll]);

  if (!job) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 rounded-lg border bg-background shadow-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Generating cards…</span>
        <Link href={`/jobs/${job.id}`} className="text-xs text-primary hover:underline">View</Link>
      </div>
      {job.currentStep && (
        <div className="text-xs text-muted-foreground capitalize">{job.currentStep.replace('_', ' ')}</div>
      )}
      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${job.progressPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{job.progressPct}%</span>
        <span className="capitalize">{job.status}</span>
      </div>
    </div>
  );
}
