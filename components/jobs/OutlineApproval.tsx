'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';

interface Section {
  name: string;
  page_start: number;
  page_end: number;
  description?: string;
}

interface SortableRowProps {
  id: string;
  section: Section;
  index: number;
  onUpdate: (index: number, updates: Partial<Section>) => void;
  onDelete: (index: number) => void;
}

function SortableRow({ id, section, index, onUpdate, onDelete }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 border rounded bg-background">
      <span
        className="cursor-grab text-muted-foreground px-1 select-none"
        {...attributes}
        {...listeners}
      >
        ⣿
      </span>
      <Input
        value={section.name}
        onChange={(e) => onUpdate(index, { name: e.target.value })}
        className="flex-1 h-8"
      />
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        pp. {section.page_start}–{section.page_end}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(index)}
        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
      >
        ✕
      </Button>
    </div>
  );
}

interface Props {
  jobId: string;
  initialOutline: Section[];
}

export function OutlineApproval({ jobId, initialOutline }: Props) {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>(initialOutline);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = sections.map((_, i) => String(i));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSections((prev) =>
        arrayMove(prev, Number(active.id), Number(over.id)),
      );
    }
  }

  function updateSection(index: number, updates: Partial<Section>) {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  }

  function deleteSection(index: number) {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleApprove() {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/jobs/${jobId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outline: sections }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json() as { error?: string };
      setError(d.error ?? 'Failed to approve outline');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>Review the section outline extracted from your PDF. You can rename, reorder, or delete sections before generating cards.</p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {sections.map((section, i) => (
              <SortableRow
                key={i}
                id={String(i)}
                section={section}
                index={i}
                onUpdate={updateSection}
                onDelete={deleteSection}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {sections.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No sections remaining. Add sections or cancel the job.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={handleApprove}
        disabled={loading || sections.length === 0}
        className="w-full"
      >
        {loading ? 'Approving…' : `Approve and generate (${sections.length} section${sections.length !== 1 ? 's' : ''})`}
      </Button>
    </div>
  );
}
