'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, Sparkles, Plus, Trash2, CheckCircle2, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CATEGORY_COLORS, EISENHOWER_LABELS, type TaskStatus, type EisenhowerCategory, type TaskCategory } from '@/lib/types';
import { formatDuration } from '@/lib/time-utils';

interface ParsedTaskItem {
  title: string;
  notes: string | null;
  estimatedMinutes: number;
  category: TaskCategory;
  eisenhowerCategory: EisenhowerCategory;
  priority: number;
  selected: boolean;
  isDuplicate?: boolean;
}

const CATEGORIES: TaskCategory[] = ['Creative', 'Admin', 'Maintenance', 'Health', 'Learning', 'Social'];
const EISENHOWER: EisenhowerCategory[] = ['do_first', 'schedule', 'delegate', 'eliminate'];

interface NotesImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatus?: TaskStatus;
}

export function NotesImporter({ open, onOpenChange, defaultStatus = 'backlog' }: NotesImporterProps) {
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedTaskItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'importing' | 'done'>('idle');
  const createTask = useAppStore((s) => s.createTask);
  const allTasks = useAppStore((s) => s.tasks);
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleParse = useCallback(async () => {
    const text = rawText.trim();
    if (!text) return;

    setStatus('parsing');
    try {
      const res = await fetch('/api/ai/parse-todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, defaultStatus }),
      });
      const data = await res.json();
      const items = (Array.isArray(data) ? data : []).map((t: Record<string, unknown>) => ({
        title: String(t.title ?? '').slice(0, 200) || 'Untitled',
        notes: t.notes ? String(t.notes) : null,
        estimatedMinutes: Math.max(1, Math.round(Number(t.estimatedMinutes) || 30)),
        category: (CATEGORIES as readonly string[]).includes(String(t.category)) ? String(t.category) as TaskCategory : 'Admin',
        eisenhowerCategory: (EISENHOWER as readonly string[]).includes(String(t.eisenhowerCategory)) ? String(t.eisenhowerCategory) as EisenhowerCategory : 'schedule',
        priority: Math.max(1, Math.min(5, Math.round(Number(t.priority) || 3))),
        selected: true,
      }));
      // Filter duplicates against existing tasks
      const existingTitles = new Set(
        allTasks.map((t) => t.title.toLowerCase().trim())
      );
      for (const item of items) {
        if (existingTitles.has(item.title.toLowerCase().trim())) {
          item.isDuplicate = true;
          item.selected = false;
        }
      }
      setParsed(items);
      setStatus('idle');
    } catch (err) {
      console.error('parse failed', err);
      setStatus('idle');
      toast({ title: 'Parse failed', description: 'Could not parse the text. Check the format and try again.', variant: 'destructive' });
    }
  }, [rawText, defaultStatus, toast, allTasks]);

  const toggleItem = useCallback((idx: number) => {
    setParsed((prev) => prev.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t));
  }, []);

  const removeItem = useCallback((idx: number) => {
    setParsed((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateField = useCallback((idx: number, field: keyof ParsedTaskItem, value: string | number) => {
    setParsed((prev) => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  }, []);

  const selectAll = useCallback((v: boolean) => {
    setParsed((prev) => prev.map((t) => ({ ...t, selected: v })));
  }, []);

  const handleImport = useCallback(async () => {
    const selected = parsed.filter((t) => t.selected && t.title.trim());
    if (selected.length === 0) return;

    setStatus('importing');
    let imported = 0;
    for (const item of selected) {
      const t = await createTask({
        title: item.title,
        notes: item.notes,
        status: defaultStatus,
        category: item.category,
        eisenhowerCategory: item.eisenhowerCategory,
        estimatedMinutes: item.estimatedMinutes,
        priority: item.priority,
      });
      if (t) imported++;
    }

    setStatus('done');
    toast({
      title: `Imported ${imported} task${imported !== 1 ? 's' : ''}`,
      description: `${selected.length - imported} skipped (duplicates or errors)`,
    });

    // Reset after a brief delay
    setTimeout(() => {
      setRawText('');
      setParsed([]);
      setStatus('idle');
      onOpenChange(false);
    }, 1500);
  }, [parsed, defaultStatus, createTask, toast, onOpenChange]);

  const handlePaste = useCallback(() => {
    // Focus the textarea so paste works
    textareaRef.current?.focus();
  }, []);

  const handleClose = useCallback(() => {
    if (status === 'parsing' || status === 'importing') return;
    setRawText('');
    setParsed([]);
    setStatus('idle');
    onOpenChange(false);
  }, [status, onOpenChange]);

  const selectedCount = parsed.filter((t) => t.selected).length;
  const duplicateCount = parsed.filter((t) => t.isDuplicate).length;
  const totalMinutes = parsed.filter((t) => t.selected).reduce((s, t) => s + t.estimatedMinutes, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-4" />
            Import from Notes
          </DialogTitle>
          <DialogDescription>
            Paste your unstructured todo list — we&apos;ll parse it into tasks with AI-powered estimates and categorization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Step 1: Paste text */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <span className="size-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">1</span>
                Paste your list
              </label>
              <span className="text-[10px] text-muted-foreground">
                Supports: bullets, numbers, checkboxes, plain text
              </span>
            </div>
            <textarea
              ref={textareaRef}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              onClick={handlePaste}
              placeholder={`Buy groceries\n☐ Call dentist for appointment\n- [ ] Review pull requests\n* Design new landing page\n3. Schedule team standup\nStudy chapter 5 for exam\nMeditate 15 minutes`}
              className="w-full min-h-[120px] lg:min-h-[160px] rounded-md border bg-background px-3 py-2 text-xs font-mono resize-y placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              disabled={status === 'parsing' || status === 'importing'}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => void handleParse()}
                disabled={!rawText.trim() || status === 'parsing' || status === 'importing'}
              >
                {status === 'parsing' ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                {status === 'parsing' ? 'Parsing…' : 'Parse with AI'}
              </Button>
              {rawText.trim() && status === 'idle' && (
                <span className="text-[10px] text-muted-foreground">
                  {rawText.split(/\n/).filter((l) => l.trim()).length} lines detected
                </span>
              )}
            </div>
          </div>

          {/* Step 2: Review & Edit parsed tasks */}
          {parsed.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold flex items-center gap-1.5">
                  <span className="size-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">2</span>
                  Review ({selectedCount}/{parsed.length})
                </label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">
                    {formatDuration(totalMinutes)} total
                  </Badge>
                  {duplicateCount > 0 && (
                    <Badge variant="outline" className="text-[8px] px-1 py-0 border-amber-500/40 text-amber-600">
                      {duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''} filtered
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] px-2"
                    onClick={() => selectAll(selectedCount === parsed.length ? false : true)}
                  >
                    {selectedCount === parsed.length ? 'Deselect all' : 'Select all'}
                  </Button>
                </div>
              </div>

              <Card className="overflow-hidden">
                <div className="max-h-[320px] overflow-y-auto divide-y divide-border/50">
                  {parsed.map((item, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-start gap-2 px-2 py-1.5 hover:bg-muted/30 transition-colors',
                        !item.selected && 'opacity-40',
                      )}
                    >
                      <Checkbox
                        checked={item.selected}
                        onCheckedChange={() => toggleItem(idx)}
                        className="size-3.5 mt-0.5 shrink-0"
                      />
                      {item.isDuplicate && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0 border-amber-500/40 text-amber-600 mt-0.5 shrink-0">
                          Duplicate
                        </Badge>
                      )}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <Input
                          value={item.title}
                          onChange={(e) => updateField(idx, 'title', e.target.value)}
                          className="h-6 text-xs px-1.5"
                        />
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <select
                            value={item.category}
                            onChange={(e) => updateField(idx, 'category', e.target.value)}
                            className="h-5 text-[10px] rounded border bg-background px-1 outline-none"
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          <select
                            value={item.eisenhowerCategory}
                            onChange={(e) => updateField(idx, 'eisenhowerCategory', e.target.value)}
                            className="h-5 text-[10px] rounded border bg-background px-1 outline-none"
                          >
                            {EISENHOWER.map((e) => (
                              <option key={e} value={e}>{EISENHOWER_LABELS[e].label}</option>
                            ))}
                          </select>
                          <Input
                            type="number"
                            min={1}
                            max={1440}
                            value={item.estimatedMinutes}
                            onChange={(e) => updateField(idx, 'estimatedMinutes', Number(e.target.value) || 30)}
                            className="h-5 w-16 text-[10px] px-1"
                          />
                          <span className="text-[9px] text-muted-foreground">min</span>
                          <Badge variant="outline" className={cn('text-[9px] px-1 py-0', CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.Admin)}>
                            {item.category}
                          </Badge>
                        </div>
                        {item.notes && (
                          <p className="text-[10px] text-muted-foreground truncate">{item.notes}</p>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-5 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(idx)}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Step 3: Import */}
          {parsed.length > 0 && (
            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] text-muted-foreground">
                {selectedCount > 0 ? (
                  <span className="font-medium text-foreground">{selectedCount} tasks</span>
                ) : null}{' '}
                → {defaultStatus}
              </div>
              <Button
                className="gap-1.5"
                onClick={() => void handleImport()}
                disabled={selectedCount === 0 || status === 'importing'}
              >
                {status === 'importing' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : status === 'done' ? (
                  <CheckCircle2 className="size-3.5" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                {status === 'importing' ? 'Importing…' : status === 'done' ? 'Done!' : `Import ${selectedCount} tasks`}
              </Button>
            </div>
          )}

          {/* Tips */}
          {parsed.length === 0 && status === 'idle' && (
            <div className="rounded-md border border-dashed border-border px-3 py-2 text-[10px] text-muted-foreground space-y-1">
              <p className="font-medium text-foreground/70">Supported formats:</p>
              <div className="grid grid-cols-2 gap-1 font-mono text-[9px]">
                <div>
                  <p>• Plain lines</p>
                  <p>• - Bullets</p>
                  <p>• - [ ] Checkboxes</p>
                </div>
                <div>
                  <p>• 1. Numbered</p>
                  <p>• ☑ Unicode marks</p>
                  <p>• ~~Strikethrough~~</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
