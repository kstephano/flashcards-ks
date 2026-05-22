'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface SpendData { currentMonthSpendUsd: number; monthlyCapUsd: number; }

export function Header() {
  const [spend, setSpend] = useState<SpendData | null>(null);

  useEffect(() => {
    fetch('/api/spend').then(r => r.json()).then(setSpend).catch(() => {});
  }, []);

  const pct = spend ? Math.min(100, (spend.currentMonthSpendUsd / spend.monthlyCapUsd) * 100) : 0;

  return (
    <header className="border-b px-6 py-3 flex items-center justify-between">
      <Link href="/" className="font-semibold text-lg">Flashcards</Link>
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Dashboard</Link>
        <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground">Settings</Link>
        {spend && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span>${spend.currentMonthSpendUsd.toFixed(2)} / ${spend.monthlyCapUsd}</span>
          </div>
        )}
      </div>
    </header>
  );
}
