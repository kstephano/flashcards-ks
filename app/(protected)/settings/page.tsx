'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Settings {
  monthlySpendCapUsd: number;
  defaultMaxWebSearches: number;
  hasApiKey: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [monthlySpendCap, setMonthlySpendCap] = useState('');
  const [maxWebSearches, setMaxWebSearches] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [clearApiKey, setClearApiKey] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/settings', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        return res.json() as Promise<Settings>;
      })
      .then((data) => {
        setSettings(data);
        setMonthlySpendCap(String(data.monthlySpendCapUsd));
        setMaxWebSearches(String(data.defaultMaxWebSearches));
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const body: {
      monthlySpendCapUsd?: number;
      defaultMaxWebSearches?: number;
      apiKey?: string;
    } = {};

    if (monthlySpendCap !== '') {
      body.monthlySpendCapUsd = parseFloat(monthlySpendCap);
    }
    if (maxWebSearches !== '') {
      body.defaultMaxWebSearches = parseInt(maxWebSearches, 10);
    }
    if (clearApiKey) {
      body.apiKey = '';
    } else if (apiKey !== '') {
      body.apiKey = apiKey;
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const updated = (await res.json()) as Settings;
      setSettings(updated);
      setApiKey('');
      setClearApiKey(false);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-destructive text-sm">Failed to load settings: {error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Monthly Spend Cap */}
        <div className="space-y-1.5">
          <label htmlFor="monthlySpendCap" className="text-sm font-medium">
            Monthly Spend Cap (USD)
          </label>
          <Input
            id="monthlySpendCap"
            type="number"
            min={0}
            step={0.01}
            value={monthlySpendCap}
            onChange={(e) => { setSuccess(false); setMonthlySpendCap(e.target.value); }}
          />
          <p className="text-xs text-muted-foreground">
            Stop generating new cards when monthly API spend reaches this amount.
          </p>
        </div>

        {/* Default Max Web Searches */}
        <div className="space-y-1.5">
          <label htmlFor="maxWebSearches" className="text-sm font-medium">
            Default Max Web Searches
          </label>
          <Input
            id="maxWebSearches"
            type="number"
            min={0}
            max={10}
            value={maxWebSearches}
            onChange={(e) => { setSuccess(false); setMaxWebSearches(e.target.value); }}
          />
          <p className="text-xs text-muted-foreground">
            Maximum number of web searches per generation job (0–10).
          </p>
        </div>

        {/* Anthropic API Key */}
        <div className="space-y-1.5">
          <label htmlFor="apiKey" className="text-sm font-medium">
            Anthropic API Key
          </label>
          {settings?.hasApiKey && !clearApiKey ? (
            <div className="flex items-center gap-2">
              <Input
                id="apiKey"
                type="password"
                value=""
                placeholder="••••••••••••••••"
                readOnly
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setClearApiKey(true)}
              >
                Clear
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Input
                id="apiKey"
                type="password"
                value={clearApiKey ? '' : apiKey}
                placeholder={clearApiKey ? 'Enter new API key or leave blank to remove' : 'sk-ant-...'}
                onChange={(e) => {
                  setSuccess(false);
                  setClearApiKey(false);
                  setApiKey(e.target.value);
                }}
              />
              {settings?.hasApiKey && clearApiKey && (
                <p className="text-xs text-muted-foreground">
                  The existing key will be removed on save. Enter a new key to replace it.
                </p>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Your key is encrypted at rest and never returned in API responses.
          </p>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>

          {success && (
            <p className="text-sm text-green-600 dark:text-green-400">
              Settings saved successfully.
            </p>
          )}

          {error && settings && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
      </form>
    </div>
  );
}
