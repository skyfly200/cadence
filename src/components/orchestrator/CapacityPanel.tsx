'use client';

import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Battery, Heart, Moon, Zap } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getCapacityTier } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/time-utils';

const TIER_STYLES: Record<string, { ring: string; text: string; bg: string; label: string }> = {
  emerald: { ring: 'ring-emerald-500/40', text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-500/10', label: 'Peak' },
  amber: { ring: 'ring-amber-500/40', text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-500/10', label: 'Steady' },
  rose: { ring: 'ring-rose-500/40', text: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-500/10', label: 'Conservation' },
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
    <Card className={cn('p-2.5 ring-1', style.ring, style.bg)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Battery className={cn('size-3.5', style.text)} />
          <span className="text-[11px] font-semibold">Capacity</span>
        </div>
        <span className={cn('text-[10px] font-medium', style.text)}>{style.label}</span>
      </div>

      <div className="space-y-2">
        <div>
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="flex items-center gap-0.5 text-muted-foreground"><Zap className="size-2.5" /> Readiness</span>
            <span className={cn('font-semibold tabular-nums', style.text)}>{score ?? '—'}</span>
          </div>
          <Slider value={[score ?? 70]} min={0} max={100} step={1} onValueChange={(v) => void setCapacity({ readinessScore: v[0] })} />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Moon className="size-2.5" /> Sleep hrs</label>
            <Input type="number" step={0.5} min={0} max={14} value={capacity?.sleepHours ?? ''} onChange={(e) => void setCapacity({ sleepHours: Number(e.target.value) || null })} className="h-6 text-[11px] px-1.5 mt-0.5" />
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Heart className="size-2.5" /> Energy</label>
            <Input type="number" min={1} max={10} value={capacity?.manualEnergyRating ?? ''} onChange={(e) => void setCapacity({ manualEnergyRating: Number(e.target.value) || null })} className="h-6 text-[11px] px-1.5 mt-0.5" />
          </div>
        </div>

        <div className="rounded bg-background/60 px-2 py-1.5 border">
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="text-muted-foreground">Budget</span>
            <span className={cn('font-medium tabular-nums', over ? 'text-rose-600' : '')}>
              {formatDuration(capacity?.scheduledFocusMinutes ?? 0)}/{formatDuration(capacity?.maxAllowedFocusMinutes ?? 0)}
            </span>
          </div>
          <Progress value={pct} className={cn('h-1.5', over && '[&>div]:bg-rose-500')} />
        </div>
      </div>
    </Card>
  );
}
