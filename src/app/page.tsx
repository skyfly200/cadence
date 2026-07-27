'use client';

import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  LayoutDashboard, Calendar, Inbox, AlertTriangle, BarChart3, Settings as SettingsIcon,
  Moon, Sun, Sparkles, Mic,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Dashboard } from '@/components/orchestrator/Dashboard';
import { TimelineView } from '@/components/orchestrator/TimelineView';
import { BacklogIncubator } from '@/components/orchestrator/BacklogIncubator';
import { TriagePanel } from '@/components/orchestrator/TriagePanel';
import { StatsView } from '@/components/orchestrator/StatsView';
import { SettingsPanel } from '@/components/orchestrator/SettingsPanel';
import { VoiceInput } from '@/components/orchestrator/VoiceInput';
import { useTheme } from 'next-themes';

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  return mounted;
}

export default function Home() {
  const loadData = useAppStore((s) => s.loadData);
  const loadSettings = useAppStore((s) => s.loadSettings);
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const loading = useAppStore((s) => s.loading);
  const tasks = useAppStore((s) => s.tasks);
  const todayScore = useAppStore((s) => s.todayScore);
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const [captureOpen, setCaptureOpen] = useState(false);

  const triageCount = useMemo(() => tasks.filter((t) => t.status === 'triage_review').length, [tasks]);
  const backlogCount = useMemo(() => tasks.filter((t) => t.status === 'backlog').length, [tasks]);
  const incubatorCount = useMemo(() => tasks.filter((t) => t.status === 'incubator').length, [tasks]);

  useEffect(() => {
    void loadData();
    void loadSettings();
  }, [loadData, loadSettings]);

  return (
    <div className="min-h-dvh flex flex-col bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-sm">
                <Sparkles className="size-4 sm:size-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold tracking-tight truncate">Cadence</h1>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground hidden sm:block">
                  Capacity-aware planning · resilient timers · process-based scoring
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="hidden xs:flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 sm:px-3 py-1">
                <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground">SCORE</span>
                <span className="text-xs sm:text-sm font-bold tabular-nums">{todayScore}</span>
              </div>
              <Button
                variant="ghost" size="icon" aria-label="Quick capture"
                onClick={() => setCaptureOpen(true)}
                className="size-8 sm:size-9"
              >
                <Mic className="size-4" />
              </Button>
              {mounted && (
                <Button
                  variant="ghost" size="icon" aria-label="Toggle theme"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="size-8 sm:size-9"
                >
                  {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Quick Capture Dialog */}
      <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
        <DialogContent className="sm:max-w-md mx-3">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="size-4" /> Quick Capture
            </DialogTitle>
            <DialogDescription>
              Speak or type a task — e.g. &ldquo;Add design new poster to Incubator list&rdquo;
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <VoiceInput autoStart={captureOpen} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Main */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-2 sm:px-3 md:px-4 py-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-2">
          <TabsList className="grid w-full grid-cols-3 xs:grid-cols-6 h-auto">
            <TabsTrigger value="dashboard" className="flex flex-col xs:flex-row gap-0.5 py-1.5 text-[10px] xs:text-xs">
              <LayoutDashboard className="size-3.5" />
              <span className="truncate">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex flex-col xs:flex-row gap-0.5 py-1.5 text-[10px] xs:text-xs">
              <Calendar className="size-3.5" />
              <span className="truncate">Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="backlog" className="flex flex-col xs:flex-row gap-0.5 py-1.5 text-[10px] xs:text-xs relative">
              <Inbox className="size-3.5" />
              <span className="truncate">Backlog</span>
              {backlogCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 size-4 sm:size-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">
                  {backlogCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="incubator" className="hidden xs:flex flex-col xs:flex-row gap-0.5 py-1.5 text-[10px] xs:text-xs relative">
              <Sparkles className="size-3.5" />
              <span className="truncate">Incubator</span>
              {incubatorCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 size-4 sm:size-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">
                  {incubatorCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="triage" className="hidden xs:flex flex-col xs:flex-row gap-0.5 py-1.5 text-[10px] xs:text-xs relative">
              <AlertTriangle className="size-3.5" />
              <span className="truncate">Triage</span>
              {triageCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 size-4 sm:size-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center font-bold">
                  {triageCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="stats" className="hidden xs:flex flex-col xs:flex-row gap-0.5 py-1.5 text-[10px] xs:text-xs">
              <BarChart3 className="size-3.5" />
              <span className="truncate">Stats</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-0 focus-visible:outline-none">
            <Dashboard />
          </TabsContent>
          <TabsContent value="timeline" className="mt-0 focus-visible:outline-none">
            <TimelineView />
          </TabsContent>
          <TabsContent value="backlog" className="mt-0 focus-visible:outline-none">
            <BacklogIncubator variant="backlog" />
          </TabsContent>
          <TabsContent value="incubator" className="mt-0 focus-visible:outline-none">
            <BacklogIncubator variant="incubator" />
          </TabsContent>
          <TabsContent value="triage" className="mt-0 focus-visible:outline-none">
            <TriagePanel />
          </TabsContent>
          <TabsContent value="stats" className="mt-0 focus-visible:outline-none">
            <StatsView />
          </TabsContent>
        </Tabs>

        {/* Settings collapses into a small card at the bottom */}
        <details className="mt-4 group">
          <summary className="cursor-pointer inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground">
            <SettingsIcon className="size-3.5" />
            Settings & anchor configuration
          </summary>
          <div className="mt-3">
            <SettingsPanel />
          </div>
        </details>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background mt-auto">
        <div className="mx-auto max-w-7xl px-2 sm:px-3 md:px-4 py-2">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-muted-foreground">
            <p>Local-first · capacity-aware · no auto-rollover</p>
            <p className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              All data persists via Prisma + SQLite
            </p>
          </div>
        </div>
      </footer>

      {loading && (
        <div className="fixed inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="p-4 sm:p-6 flex items-center gap-3">
            <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading your day…</span>
          </Card>
        </div>
      )}
    </div>
  );
}
