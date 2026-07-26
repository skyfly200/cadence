'use client';

import { useEffect, useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Square, Timer as TimerIcon, Brain } from 'lucide-react';
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

  // Resilient ticking — uses delta from startTimestamp, survives tab sleep
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      tickTimer();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [tickTimer]);

  // Persist active timer to localStorage every 5s for crash recovery
  useEffect(() => {
    if (activeTimer) {
      persistRef.current = window.setInterval(() => {
        try {
          localStorage.setItem(PERSIST_KEY, JSON.stringify(activeTimer));
        } catch { /* noop */ }
      }, 5000) as unknown as number;
    } else {
      if (persistRef.current) clearInterval(persistRef.current);
      try { localStorage.removeItem(PERSIST_KEY); } catch { /* noop */ }
    }
    return () => {
      if (persistRef.current) clearInterval(persistRef.current);
    };
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
    toast({ title: interrupted ? 'Session interrupted' : 'Session complete', description: `${formatSeconds(elapsed)} of focus logged` });
  };

  return (
    <Card className={cn('p-4', activeTimer && 'ring-2 ring-primary/40')}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {activeTimer?.type === 'pomodoro' ? <TimerIcon className="size-4" /> : <Brain className="size-4" />}
          <h3 className="text-sm font-semibold">Focus Timer</h3>
        </div>
        {activeTimer && (
          <Badge variant="outline" className="text-[10px] capitalize">
            {activeTimer.type.replace('_', ' ')}
          </Badge>
        )}
      </div>

      {activeTimer && task ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground truncate">
            Working on: <span className="font-medium text-foreground">{task.title}</span>
          </p>
          <div className="text-center">
            <div className="font-mono text-4xl font-bold tabular-nums">
              {formatSeconds(elapsed)}
            </div>
            {remaining !== null && (
              <div className={cn('mt-1 text-xs', remaining < 60 ? 'text-rose-600' : 'text-muted-foreground')}>
                {remaining > 0 ? `${formatSeconds(remaining)} remaining` : 'completing…'}
              </div>
            )}
          </div>
          <div className="flex justify-center gap-2">
            <Button size="sm" variant="outline" onClick={() => handleStop(true)}>
              <Square className="size-3" /> Stop & discard
            </Button>
            <Button size="sm" onClick={() => handleStop(false)}>
              <Pause className="size-3" /> Complete
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">No active session. Pick a task and press Start.</p>
          <div className="flex flex-col gap-2">
            <Button
              size="sm" variant="outline"
              onClick={() => {
                const t = tasks.find((x) => x.status === 'today');
                if (!t) {
                  toast({ title: 'No tasks scheduled for today', variant: 'destructive' });
                  return;
                }
                void startTimer(t.id, 'pomodoro');
              }}
            >
              <TimerIcon className="size-3" /> Start Pomodoro (next today task)
            </Button>
            <Button
              size="sm" variant="ghost"
              onClick={() => {
                const t = tasks.find((x) => x.status === 'today');
                if (!t) return;
                void startTimer(t.id, 'open_flow');
              }}
            >
              <Brain className="size-3" /> Open Flow (untimed)
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
