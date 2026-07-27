'use client';

import { useEffect, useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Square, Timer as TimerIcon, Brain } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { formatSeconds } from '@/lib/time-utils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const TICK_MS = 1000;
const PERSIST_KEY = 'ido_active_timer';

export function TimerPanel() {
  const activeTimer = useAppStore((s) => s.activeTimer);
  const startTimer = useAppStore((s) => s.startTimer);
  const stopTimer = useAppStore((s) => s.stopTimer);
  const tasks = useAppStore((s) => s.tasks);
  const tickTimer = useAppStore((s) => s.tickTimer);
  const { toast } = useToast();
  const [now, setNow] = useState(Date.now());
  const persistRef = useRef<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => { setNow(Date.now()); tickTimer(); }, TICK_MS);
    return () => clearInterval(id);
  }, [tickTimer]);

  useEffect(() => {
    if (activeTimer) {
      persistRef.current = window.setInterval(() => {
        try { localStorage.setItem(PERSIST_KEY, JSON.stringify(activeTimer)); } catch { /* noop */ }
      }, 5000) as unknown as number;
    } else {
      if (persistRef.current) clearInterval(persistRef.current);
      try { localStorage.removeItem(PERSIST_KEY); } catch { /* noop */ }
    }
    return () => { if (persistRef.current) clearInterval(persistRef.current); };
  }, [activeTimer]);

  const task = activeTimer ? tasks.find((t) => t.id === activeTimer.taskId) : null;
  const elapsed = activeTimer
    ? activeTimer.elapsedBeforeStart + Math.floor((now - activeTimer.startedAt) / 1000)
    : 0;
  const remaining = activeTimer?.type === 'pomodoro' && activeTimer.targetSeconds > 0
    ? Math.max(0, activeTimer.targetSeconds - elapsed)
    : null;

  const handleStop = (interrupted: boolean) => {
    void stopTimer(interrupted);
    toast({ title: interrupted ? 'Stopped' : 'Complete', description: formatSeconds(elapsed) });
  };

  return (
    <Card className={cn('p-2 sm:p-2.5', activeTimer && 'ring-1 ring-primary/40')}>
      <div className="flex items-center justify-between mb-1.5 sm:mb-2">
        <div className="flex items-center gap-1.5">
          {activeTimer?.type === 'pomodoro' ? <TimerIcon className="size-3.5" /> : <Brain className="size-3.5" />}
          <span className="text-[11px] sm:text-xs font-semibold">Timer</span>
        </div>
        {activeTimer && <span className="text-[9px] text-muted-foreground capitalize">{activeTimer.type.replace('_', ' ')}</span>}
      </div>

      {activeTimer && task ? (
        <div className="space-y-1.5 sm:space-y-2">
          <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
            {task.title}
          </p>
          <div className="text-center">
            <div className="font-mono text-xl sm:text-2xl font-bold tabular-nums leading-none">{formatSeconds(elapsed)}</div>
            {remaining !== null && (
              <div className={cn('mt-0.5 text-[10px]', remaining < 60 ? 'text-rose-600' : 'text-muted-foreground')}>
                {remaining > 0 ? `${formatSeconds(remaining)} left` : 'done'}
              </div>
            )}
          </div>
          <div className="flex justify-center gap-1.5 sm:gap-2">
            <Button size="sm" variant="outline" className="h-7 sm:h-6 text-[10px] px-2 sm:px-2" onClick={() => handleStop(true)}>
              <Square className="size-2.5 sm:size-2.5" /> Stop
            </Button>
            <Button size="sm" className="h-7 sm:h-6 text-[10px] px-2 sm:px-2" onClick={() => handleStop(false)}>
              Complete
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[10px] sm:text-[11px] text-muted-foreground">No active session.</p>
          <div className="flex flex-col gap-1">
            <Button size="sm" variant="outline" className="h-7 sm:h-6 text-[10px] px-2 sm:px-2" onClick={() => {
              const t = tasks.find((x) => x.status === 'today');
              if (!t) { toast({ title: 'No today tasks', variant: 'destructive' }); return; }
              void startTimer(t.id, 'pomodoro');
            }}>
              <TimerIcon className="size-2.5" /> Start Pomodoro
            </Button>
            <Button size="sm" variant="ghost" className="h-7 sm:h-6 text-[10px] px-2 sm:px-2" onClick={() => {
              const t = tasks.find((x) => x.status === 'today');
              if (!t) return;
              void startTimer(t.id, 'open_flow');
            }}>
              <Brain className="size-2.5" /> Open Flow
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
