'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { OutlineApproval } from '@/components/jobs/OutlineApproval';
import { SectionProgressList } from '@/components/jobs/SectionProgressList';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface Job {
  id: string;
  status: string;
  currentStep: string | null;
  progressPct: number;
  errorMessage: string | null;
  pendingSectionOutline: Array<{ name: string; page_start: number; page_end: number; description?: string }> | null;
  deckId: string | null;
}

interface Section {
  id: string;
  sectionName: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  attemptCount: number;
  lastError: string | null;
}

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [cancelling, setCancelling] = useState(false);

  const fetchJob = useCallback(async () => {
    const res = await fetch(`/api/jobs/${id}`);
    if (!res.ok) return;
    const data = await res.json() as { job: Job; sections: Section[] };
    setJob(data.job);
    setSections(data.sections);
  }, [id]);

  useEffect(() => {
    fetchJob();
    const interval = setInterval(() => {
      if (job?.status && ['complete', 'failed', 'cancelled'].includes(job.status)) return;
      fetchJob();
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchJob, job?.status]);

  async function handleCancel() {
    setCancelling(true);
    await fetch(`/api/jobs/${id}/cancel`, { method: 'POST' });
    setCancelling(false);
    await fetchJob();
  }

  if (!job) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Generation Job</h1>
        {['pending', 'running', 'awaiting_outline_approval'].includes(job.status) && (
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelling}>
            {cancelling ? 'Cancelling…' : 'Cancel'}
          </Button>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        Status: <span className="font-medium text-foreground">{job.status}</span>
        {job.currentStep && <span> · Step: {job.currentStep}</span>}
        {job.progressPct > 0 && <span> · {job.progressPct}%</span>}
      </div>

      {job.status === 'awaiting_outline_approval' && job.pendingSectionOutline && (
        <div className="space-y-3">
          <h2 className="font-semibold">Review Section Outline</h2>
          <OutlineApproval jobId={job.id} initialOutline={job.pendingSectionOutline} />
        </div>
      )}

      {job.status === 'running' && sections.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Section Progress</h2>
          <SectionProgressList sections={sections} />
        </div>
      )}

      {job.status === 'complete' && job.deckId && (
        <div className="space-y-3">
          <p className="text-green-600 font-medium">Generation complete!</p>
          <Button onClick={() => router.push(`/decks/${job.deckId}`)}>View Deck</Button>
        </div>
      )}

      {job.status === 'failed' && job.errorMessage && (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          {job.errorMessage}
        </div>
      )}

      {job.status === 'cancelled' && (
        <p className="text-muted-foreground">This job was cancelled.</p>
      )}
    </div>
  );
}
