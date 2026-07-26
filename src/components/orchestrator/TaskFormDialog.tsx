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
import { Sparkles, Clock, Loader2 } from 'lucide-react';
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

const EISENHOWER: { value: EisenhowerCategory; label: string; desc: string }[] = [
  { value: 'do_first', label: 'Do First', desc: 'Urgent + Important' },
  { value: 'schedule', label: 'Schedule', desc: 'Important, not urgent' },
  { value: 'delegate', label: 'Delegate', desc: 'Urgent, not important' },
  { value: 'eliminate', label: 'Eliminate', desc: 'Neither' },
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
      } else {
        setTitle(''); setNotes(''); setCategory('Admin');
        setStatus(defaultStatus); setEisenhower('schedule');
        setEstimatedMinutes(30); setPriority(2);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editTask ? 'Edit Task' : 'New Task'}</DialogTitle>
          <DialogDescription>
            Capture the task, estimate duration, and slot it into the right zone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="tf-title">Title</Label>
            <Input id="tf-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Draft Q3 OKR proposal" autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tf-notes">Notes (optional)</Label>
            <Textarea id="tf-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Context, sub-steps, links…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Destination</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="incubator">Incubator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Eisenhower Quadrant</Label>
            <ToggleGroup type="single" value={eisenhower} onValueChange={(v) => v && setEisenhower(v as EisenhowerCategory)} className="grid grid-cols-2 gap-2">
              {EISENHOWER.map((e) => (
                <ToggleGroupItem key={e.value} value={e.value} className="flex-col h-auto py-2 items-start text-left">
                  <span className="font-medium text-xs">{e.label}</span>
                  <span className="text-[10px] text-muted-foreground">{e.desc}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Estimated Duration</Label>
              <Button type="button" variant="ghost" size="sm" onClick={runAiEstimate} disabled={estimating} className="h-7 text-xs">
                {estimating ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                AI estimate
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <Input
                type="number" min={5} step={5}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Math.max(5, Number(e.target.value) || 5))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">min · {formatDuration(estimatedMinutes)}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_DURATIONS.map((d) => (
                <Button
                  key={d} type="button" variant={estimatedMinutes === d ? 'default' : 'outline'} size="sm"
                  className="h-7 text-xs"
                  onClick={() => setEstimatedMinutes(d)}
                >
                  {formatDuration(d)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Priority (1 = highest)</Label>
            <ToggleGroup type="single" value={String(priority)} onValueChange={(v) => v && setPriority(Number(v))}>
              {[1, 2, 3, 4, 5].map((p) => (
                <ToggleGroupItem key={p} value={String(p)} className="size-9">{p}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>{editTask ? 'Save changes' : 'Create task'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
