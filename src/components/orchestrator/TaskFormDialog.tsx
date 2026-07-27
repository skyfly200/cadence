'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Sparkles, Clock, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import {
  TASK_CATEGORIES, PRESET_DURATIONS, type Task, type EisenhowerCategory, type TaskStatus,
} from '@/lib/types';
import { formatDuration } from '@/lib/time-utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editTask?: Task | null;
  defaultStatus?: TaskStatus;
}

const EISENHOWER: { value: EisenhowerCategory; label: string; color: string }[] = [
  { value: 'do_first', label: '⚡ Do First', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
  { value: 'schedule', label: '📅 Schedule', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  { value: 'delegate', label: '👥 Delegate', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  { value: 'eliminate', label: '🗑 Eliminate', color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
];

export function TaskFormDialog({ open, onOpenChange, editTask, defaultStatus = 'backlog' }: Props) {
  const createTask = useAppStore((s) => s.createTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<string>('Admin');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [eisenhower, setEisenhower] = useState<EisenhowerCategory>('schedule');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [priority, setPriority] = useState(2);
  const [estimating, setEstimating] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    if (open) {
      if (editTask) {
        setTitle(editTask.title);
        setNotes(editTask.notes ?? '');
        setCategory(editTask.category);
        setStatus(editTask.status);
        setEisenhower(editTask.eisenhowerCategory);
        setEstimatedMinutes(editTask.estimatedMinutes);
        setPriority(editTask.priority);
        setShowNotes(!!editTask.notes);
      } else {
        setTitle(''); setNotes(''); setCategory('Admin');
        setStatus(defaultStatus); setEisenhower('schedule');
        setEstimatedMinutes(30); setPriority(2);
        setShowNotes(false);
      }
    }
  }, [open, editTask, defaultStatus]);

  const runAiEstimate = async () => {
    if (!title.trim()) {
      toast({ title: 'Enter a title first', variant: 'destructive' });
      return;
    }
    setEstimating(true);
    try {
      const r = await fetch('/api/ai/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, notes, category }),
      });
      const data = await r.json();
      if (data.estimatedMinutes) {
        setEstimatedMinutes(data.estimatedMinutes);
        toast({
          title: `Estimated ${formatDuration(data.estimatedMinutes)}`,
          description: `Confidence ${Math.round((data.confidence ?? 0) * 100)}%${data.reasoning ? ` · ${data.reasoning}` : ''}`,
        });
      }
    } catch {
      toast({ title: 'Estimate failed', variant: 'destructive' });
    } finally {
      setEstimating(false);
    }
  };

  const save = async () => {
    if (!title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    const payload = {
      title: title.trim(), notes: notes.trim() || undefined,
      category, status, eisenhowerCategory: eisenhower,
      estimatedMinutes, priority,
    };
    if (editTask) {
      await updateTask(editTask.id, payload);
      toast({ title: 'Task updated' });
    } else {
      const t = await createTask(payload);
      if (t) toast({ title: 'Task created', description: `"${t.title}"` });
    }
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-4 gap-3" onKeyDown={handleKeyDown}>
        <DialogHeader className="px-0 pt-0 pb-0">
          <DialogTitle className="text-sm font-semibold">{editTask ? 'Edit Task' : 'New Task'}</DialogTitle>
          <DialogDescription className="sr-only">
            Capture the task, estimate duration, and slot it into the right zone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 px-0">
          {/* Title */}
          <Input
            id="tf-title" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?" autoFocus
            className="text-sm h-9"
          />

          {/* Category + Destination inline */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Destination" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="incubator">Incubator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Eisenhower - 4 compact buttons */}
          <div>
            <Label className="text-[11px] text-muted-foreground mb-1">Eisenhower</Label>
            <div className="grid grid-cols-4 gap-1">
              {EISENHOWER.map((e) => (
                <button
                  key={e.value}
                  type="button"
                  onClick={() => setEisenhower(e.value)}
                  className={`rounded-md px-1.5 py-1.5 text-[11px] font-medium text-center transition-colors leading-tight ${
                    eisenhower === e.value
                      ? e.color + ' ring-1 ring-current/20'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration - compact single line */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Clock className="size-3 text-muted-foreground shrink-0" />
            <Input
              type="number" min={5} step={5}
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(Math.max(5, Number(e.target.value) || 5))}
              className="w-14 h-7 text-xs"
            />
            <span className="text-[11px] text-muted-foreground">min</span>
            {PRESET_DURATIONS.map((d) => (
              <button
                key={d} type="button"
                onClick={() => setEstimatedMinutes(d)}
                className={`h-6 px-1.5 text-[11px] rounded transition-colors ${
                  estimatedMinutes === d
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                }`}
              >
                {formatDuration(d)}
              </button>
            ))}
            <button
              type="button"
              onClick={runAiEstimate}
              disabled={estimating}
              className="h-6 px-1.5 text-[11px] rounded bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900 transition-colors ml-auto disabled:opacity-50"
            >
              {estimating ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3 inline -mt-0.5" />}
              <span className="ml-1">AI</span>
            </button>
          </div>

          {/* Priority - inline compact */}
          <div className="flex items-center gap-1.5">
            <Label className="text-[11px] text-muted-foreground shrink-0">Priority</Label>
            <ToggleGroup type="single" value={String(priority)} onValueChange={(v) => v && setPriority(Number(v))}>
              {[1, 2, 3, 4, 5].map((p) => (
                <ToggleGroupItem key={p} value={String(p)} className="size-6 text-[11px] p-0">{p}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Notes - collapsible */}
          {!showNotes ? (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <ChevronDown className="size-3" />
              Add notes
            </button>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-muted-foreground">Notes</Label>
                <button
                  type="button"
                  onClick={() => setShowNotes(false)}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <ChevronUp className="size-3" />
                  Hide
                </button>
              </div>
              <Textarea
                id="tf-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                rows={2} placeholder="Context, sub-steps, links…"
                className="text-xs min-h-0"
              />
            </div>
          )}
        </div>

        <DialogFooter className="px-0 pb-0 pt-1 gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">
            Cancel
          </Button>
          <Button size="sm" onClick={save} className="text-xs h-8">
            {editTask ? 'Save changes' : 'Create'} ⌘↵
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
