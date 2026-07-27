'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Settings as SettingsIcon, Save, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { formatDuration } from '@/lib/time-utils';

const DEFAULTS = {
  wakeTime: '07:00',
  sleepTime: '23:00',
  breakfastTime: '08:00',
  lunchTime: '13:00',
  dinnerTime: '19:00',
  hydrationInterval: 90,
  defaultPomodoroMinutes: 25,
  defaultBreakMinutes: 5,
};

type FormState = typeof DEFAULTS;

function SettingsForm({ initial }: { initial: FormState }) {
  const loadSettings = useAppStore((s) => s.loadSettings);
  const generateAnchors = useAppStore((s) => s.generateAnchors);
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(initial);

  const save = async () => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      await loadSettings();
      toast({ title: 'Settings saved' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  const regenerateAnchors = async () => {
    const { timeBlocks, deleteTimeBlock } = useAppStore.getState();
    const anchors = timeBlocks.filter((b) => b.isAnchor);
    for (const a of anchors) await deleteTimeBlock(a.id);
    await generateAnchors();
    toast({ title: 'Anchors regenerated' });
  };

  return (
    <Card className="p-3 sm:p-4 max-w-2xl">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <SettingsIcon className="size-4" />
        <h3 className="text-sm font-semibold">Settings</h3>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">Daily Rhythm</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Wake time</Label>
              <Input type="time" value={form.wakeTime} onChange={(e) => setForm({ ...form, wakeTime: e.target.value })} className="h-8 sm:h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sleep time</Label>
              <Input type="time" value={form.sleepTime} onChange={(e) => setForm({ ...form, sleepTime: e.target.value })} className="h-8 sm:h-8 text-sm" />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <Label className="text-xs">Hydration interval</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[form.hydrationInterval]}
                  min={30} max={180} step={15}
                  onValueChange={(v) => setForm({ ...form, hydrationInterval: v[0] })}
                  className="flex-1"
                />
                <span className="text-xs tabular-nums w-12">{form.hydrationInterval}m</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">Anchor Blocks (meals)</h4>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Breakfast</Label>
              <Input type="time" value={form.breakfastTime} onChange={(e) => setForm({ ...form, breakfastTime: e.target.value })} className="h-8 sm:h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Lunch</Label>
              <Input type="time" value={form.lunchTime} onChange={(e) => setForm({ ...form, lunchTime: e.target.value })} className="h-8 sm:h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dinner</Label>
              <Input type="time" value={form.dinnerTime} onChange={(e) => setForm({ ...form, dinnerTime: e.target.value })} className="h-8 sm:h-8 text-sm" />
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">Timer defaults</h4>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Pomodoro focus ({formatDuration(form.defaultPomodoroMinutes)})</Label>
              <Slider
                value={[form.defaultPomodoroMinutes]}
                min={15} max={60} step={5}
                onValueChange={(v) => setForm({ ...form, defaultPomodoroMinutes: v[0] })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Break ({formatDuration(form.defaultBreakMinutes)})</Label>
              <Slider
                value={[form.defaultBreakMinutes]}
                min={5} max={30} step={5}
                onValueChange={(v) => setForm({ ...form, defaultBreakMinutes: v[0] })}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button onClick={() => void save()}><Save className="size-4" /> Save settings</Button>
          <Button variant="outline" onClick={() => void regenerateAnchors()}>
            <RefreshCw className="size-4" /> Regenerate anchors
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function SettingsPanel() {
  const settings = useAppStore((s) => s.settings);
  const initial: FormState = settings
    ? {
        wakeTime: settings.wakeTime,
        sleepTime: settings.sleepTime,
        breakfastTime: settings.breakfastTime,
        lunchTime: settings.lunchTime,
        dinnerTime: settings.dinnerTime,
        hydrationInterval: settings.hydrationInterval,
        defaultPomodoroMinutes: settings.defaultPomodoroMinutes,
        defaultBreakMinutes: settings.defaultBreakMinutes,
      }
    : DEFAULTS;

  return <SettingsForm key={JSON.stringify(initial)} initial={initial} />;
}
