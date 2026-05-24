'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SpendData { currentMonthSpendUsd: number; monthlyCapUsd: number; }

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/settings', label: 'Settings' },
];

export function Header() {
  const [spend, setSpend] = useState<SpendData | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const fetchSpend = () => fetch('/api/spend').then(r => r.json()).then(setSpend).catch(() => {});
    fetchSpend();
    window.addEventListener('spend-settings-updated', fetchSpend);
    return () => window.removeEventListener('spend-settings-updated', fetchSpend);
  }, []);

  const pct = spend ? Math.min(100, (spend.currentMonthSpendUsd / spend.monthlyCapUsd) * 100) : 0;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity"
          >
            <span>🗂️</span>
            <span>Flashcards</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop spend bar */}
          {spend && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span>${spend.currentMonthSpendUsd.toFixed(2)} / ${spend.monthlyCapUsd}</span>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            className="sm:hidden flex items-center justify-center w-10 h-10 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors active:bg-muted"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(o => !o)}
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="4" x2="16" y2="16" />
                <line x1="16" y1="4" x2="4" y2="16" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="17" y2="6" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="14" x2="17" y2="14" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 bg-background border-b shadow-lg z-50 sm:hidden">
          <div className="max-w-5xl mx-auto px-4 py-3 space-y-1">
            {navLinks.map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-3 py-3 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            {spend && (
              <div className="px-3 py-3 flex items-center gap-3 text-xs text-muted-foreground border-t mt-2 pt-3">
                <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden flex-shrink-0">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span>${spend.currentMonthSpendUsd.toFixed(2)} / ${spend.monthlyCapUsd} monthly cap</span>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
