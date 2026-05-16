'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, GripVertical } from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/Button';
import type { MusicianWithStatus } from '@/types';

function Row({ musician, rank }: { musician: MusicianWithStatus; rank: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: musician.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 border-b border-slate-100 px-3 py-2.5 ${musician.is_blacklisted ? 'bg-red-50' : 'bg-white'}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab text-slate-400 hover:text-slate-600" aria-label="Drag to reorder">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-8 text-center text-sm font-semibold text-slate-500">{rank}</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">{musician.first_name} {musician.last_name}</p>
        <p className="text-xs text-slate-500">{musician.email}</p>
      </div>
      <div className="flex gap-1">
        {musician.is_blacklisted && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Do not contact</span>
        )}
        {musician.currently_unavailable && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Unavailable</span>
        )}
      </div>
    </div>
  );
}

export function RankedList({ position, initialMusicians }: { position: string; initialMusicians: MusicianWithStatus[] }) {
  const [musicians, setMusicians] = useState(initialMusicians);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setMusicians((items) => {
      const oldIndex = items.findIndex((m) => m.id === active.id);
      const newIndex = items.findIndex((m) => m.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const ranks = musicians.map((m, i) => ({ id: m.id, rank: i + 1 }));
      const res = await fetch('/api/musicians/rerank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ranks }),
      });
      const body = await res.json();
      if (!res.ok) { toast.error(body.error || 'Save failed'); return; }
      setMusicians((items) => items.map((m, i) => ({ ...m, rank: i + 1 })));
      setDirty(false);
      toast.success('Ranking saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/musicians/positions" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back to positions
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{position} — Ranked List</h1>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-sm text-amber-600">Unsaved changes</span>}
          <Button onClick={save} loading={saving} disabled={!dirty}>Save Order</Button>
        </div>
      </div>

      <p className="mt-1 text-sm text-slate-500">Drag rows to reorder. Rank 1 is contacted first.</p>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={musicians.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            {musicians.map((m, i) => <Row key={m.id} musician={m} rank={i + 1} />)}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
