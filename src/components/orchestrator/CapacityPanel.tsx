'use client';

import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Battery, Heart, Moon, Zap } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getCapacityTier } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/time-utils';

const TIER_STYLES: Record<string, { ring: string; text: string; bg: string; label: string }> = {
  emerald: { ring: 'ring-emerald-500/40', text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-500/10', label: 'Peak Capacity' },
  amber: { ring: 'ring-amber-500/40', text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-500/10', label: 'Steady Capacity' },
  rose: { ring: 'ring-rose-500/40', text: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-500/10', label: 'Conservation Mode' },
};

export function CapacityPanel() {
  const capacity = useAppStore((s) => s.capacity);
  const setCapacity = useAppStore((s) => s.setCapacity);

  const score = capacity?.readinessScore ?? null;
  const tier = getCapacityTier(score);
  const style = TIER_STYLES[tier.color];

  const pct = capacity && capacity.maxAllowedFocusMinutes > 0
    ? Math.min(100, Math.round((capacity.scheduledFocusMinutes / capacity.maxAllowedFocusMinutes) * 100))
    : 0;
  const over = (capacity?.scheduledFocusMinutes ?? 0) > (capacity?.maxAllowedFocusMinutes ?? 0);

  return (
    <Card className={cn('p-4 ring-1', style.ring, style.bg)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Battery className={cn('size-5', style.text)} />
          <h3 className="text-sm font-semibold">Daily Capacity</h3>
        </div>
        <span className={cn('text-xs font-medium', style.text)}>{style.label}</span>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Zap className="size-3" /> Readiness Score
            </span>
            <span className={cn('font-semibold', style.text)}>
              {score !== null ? `${score}/100` : 'not set'}
            </span>
          </div>
          <Slider
            value={[score ?? 70]}
            min={0} max={100} step={1}
            onValueChange={(v) => void setCapacity({ readinessScore: v[0] })}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Conservation (&lt;60)</span>
            <span>Steady (60–84)</span>
            <span>Peak (85+)</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Moon className="size-3" /> Sleep (hrs)</Label>
            <Input
              type="number" step={0.5} min={0} max={14}
              value={capacity?.sleepHours ?? ''}
              onChange={(e) => void setCapacity({ sleepHours: Number(e.target.value) || null })}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Heart className="size-3" /> Energy (1-10)</Label>
            <Input
              type="number" min={1} max={10}
              value={capacity?.manualEnergyRating ?? ''}
              onChange={(e) => void setCapacity({ manualEnergyRating: Number(e.target.value) || null })}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="rounded-md bg-background/60 p-3 border">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Focus budget used</span>
            <span className={cn('font-semibold', over ? 'text-rose-600' : 'text-foreground')}>
              {formatDuration(capacity?.scheduledFocusMinutes ?? 0)} / {formatDuration(capacity?.maxAllowedFocusMinutes ?? 0)}
            </span>
          </div>
          <Progress value={pct} className={cn('h-2', over && '[&>div]:bg-rose-500')} />
          {over && (
            <p className="mt-1.5 text-[11px] text-rose-600 dark:text-rose-400">
              Over capacity by {formatDuration((capacity?.scheduledFocusMinutes ?? 0) - (capacity?.maxAllowedFocusMinutes ?? 0))}. Move lower-priority items back to backlog.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
