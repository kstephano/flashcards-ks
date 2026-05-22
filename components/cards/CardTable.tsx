'use client';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CardEditRow } from './CardEditRow';
import type { FlashCard } from './types';

export function CardTable({ cards }: { cards: FlashCard[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localCards, setLocalCards] = useState(cards);

  function handleSaved(updated: FlashCard) {
    setLocalCards(prev => prev.map(c => c.id === updated.id ? updated : c));
    setEditingId(null);
  }

  return (
    <div className="space-y-2">
      {localCards.map(card => (
        <div key={card.id} className="rounded-lg border p-4">
          {editingId === card.id ? (
            <CardEditRow card={card} onSaved={handleSaved} onCancel={() => setEditingId(null)} />
          ) : (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="font-medium text-sm">{card.front}</div>
                  <div className="text-sm text-muted-foreground">{card.back}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">{card.cardType}</Badge>
                  {card.accuracyScore && <span className="text-xs text-muted-foreground">A:{card.accuracyScore} R:{card.relevanceScore}</span>}
                  {card.humanEdited && <Badge variant="secondary" className="text-xs">edited</Badge>}
                  <button onClick={() => setEditingId(card.id)} className="text-xs text-primary hover:underline">Edit</button>
                </div>
              </div>
              {card.sourcePage && <div className="text-xs text-muted-foreground">p.{card.sourcePage}{card.sourceQuote ? ` — "${(card.sourceQuote as string).slice(0, 80)}…"` : ''}</div>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
