'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { FlashCard } from './types';

export function CardEditRow({ card, onSaved, onCancel }: { card: FlashCard; onSaved: (updated: FlashCard) => void; onCancel: () => void }) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [explanation, setExplanation] = useState(card.explanation ?? '');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    const res = await fetch(`/api/cards/${card.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ front, back, explanation }) });
    const updated = await res.json() as FlashCard;
    setLoading(false);
    onSaved(updated);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1"><Label className="text-xs">Front</Label><Textarea value={front} onChange={e => setFront(e.target.value)} rows={3} /></div>
      <div className="space-y-1"><Label className="text-xs">Back</Label><Textarea value={back} onChange={e => setBack(e.target.value)} rows={3} /></div>
      <div className="space-y-1"><Label className="text-xs">Explanation</Label><Textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2} /></div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={loading}>{loading ? 'Saving…' : 'Save'}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
