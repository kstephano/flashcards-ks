interface SectionStatus {
  id: string;
  sectionName: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  attemptCount: number;
  lastError: string | null;
}

interface Props {
  sections: SectionStatus[];
}

const statusIcon: Record<string, string> = {
  pending: '○',
  running: '⟳',
  complete: '✓',
  failed: '✗',
};

const statusColor: Record<string, string> = {
  pending: 'text-muted-foreground',
  running: 'text-blue-500',
  complete: 'text-green-600',
  failed: 'text-destructive',
};

export function SectionProgressList({ sections }: Props) {
  return (
    <div className="space-y-1">
      {sections.map((s) => (
        <div key={s.id} className="flex items-center gap-2 text-sm">
          <span className={statusColor[s.status] ?? ''}>{statusIcon[s.status] ?? '?'}</span>
          <span className="flex-1">{s.sectionName}</span>
          {s.status === 'failed' && s.lastError && (
            <span className="text-xs text-destructive truncate max-w-48">{s.lastError}</span>
          )}
        </div>
      ))}
    </div>
  );
}
