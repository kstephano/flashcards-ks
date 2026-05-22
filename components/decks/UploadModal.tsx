'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { CostEstimateDisplay } from './CostEstimateDisplay';
import type { CostBreakdown } from '@/lib/cost-estimator';
import { useRouter } from 'next/navigation';

interface Props {
  sectionId: string;
  children: React.ReactNode;
}

export function UploadModal({ sectionId, children }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<CostBreakdown | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [examName, setExamName] = useState('');
  const [cardCount, setCardCount] = useState('');
  const [maxSearches, setMaxSearches] = useState(3);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const file = fileRef.current?.files?.[0];
    if (!file) { setLoading(false); return; }

    const form = new FormData();
    form.append('file', file);
    form.append('sectionId', sectionId);
    if (examName) form.append('examName', examName);
    if (cardCount) form.append('requestedCardCount', cardCount);
    form.append('maxWebSearches', String(maxSearches));

    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? 'Upload failed');
      return;
    }

    if (data.cacheHit) {
      setOpen(false);
      router.refresh();
      return;
    }

    setEstimate(data.estimate);
    setJobId(data.jobId);
  }

  function handleConfirm() {
    setOpen(false);
    if (jobId) router.push(`/jobs/${jobId}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement}>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Flashcards</DialogTitle>
        </DialogHeader>

        {!estimate ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pdf-file">PDF file (max 100 pages)</Label>
              <Input
                id="pdf-file"
                type="file"
                accept=".pdf"
                ref={fileRef}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam-name">Exam name (optional)</Label>
              <Input
                id="exam-name"
                placeholder="e.g. USMLE Step 1, CFA Level 1"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-count">Target card count (optional)</Label>
              <Input
                id="card-count"
                type="number"
                min={1}
                max={500}
                placeholder="Default: 20 per section"
                value={cardCount}
                onChange={(e) => setCardCount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Web searches for exam research: {maxSearches}</Label>
              <Slider
                min={0}
                max={10}
                step={1}
                value={[maxSearches]}
                onValueChange={(v) => setMaxSearches(typeof v === 'number' ? v : v[0])}
              />
              <p className="text-xs text-muted-foreground">
                More searches = better exam targeting, higher cost (~$0.01/search)
              </p>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Analyzing…' : 'Estimate cost & upload'}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <CostEstimateDisplay estimate={estimate} />
            <p className="text-sm text-muted-foreground">
              Your job has been queued. Confirm to view progress and approve the section outline.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEstimate(null)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleConfirm}>
                Approve & generate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
