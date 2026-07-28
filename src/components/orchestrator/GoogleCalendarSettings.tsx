'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, Link2, Unlink, RefreshCw, ExternalLink, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function GoogleCalendarSettings() {
  const googleCalendar = useAppStore((s) => s.googleCalendar);
  const loadGoogleCalendarStatus = useAppStore((s) => s.loadGoogleCalendarStatus);
  const saveGoogleCredentials = useAppStore((s) => s.saveGoogleCredentials);
  const connectGoogleCalendar = useAppStore((s) => s.connectGoogleCalendar);
  const disconnectGoogleCalendar = useAppStore((s) => s.disconnectGoogleCalendar);
  const syncGoogleCalendar = useAppStore((s) => s.syncGoogleCalendar);
  const { toast } = useToast();

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    void loadGoogleCalendarStatus();
  }, [loadGoogleCalendarStatus]);

  // Check for OAuth callback params in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gcalConnected = params.get('gcal');
    const gcalError = params.get('gcal_error');

    if (gcalConnected === 'connected') {
      toast({ title: 'Google Calendar connected!', description: 'Your calendar is now linked.' });
      void loadGoogleCalendarStatus();
      // Clean URL
      window.history.replaceState({}, '', '/');
    } else if (gcalError) {
      toast({
        title: 'Connection failed',
        description: decodeURIComponent(gcalError).replace(/_/g, ' '),
        variant: 'destructive',
      });
      window.history.replaceState({}, '', '/');
    }
  }, [toast, loadGoogleCalendarStatus]);

  const handleSaveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast({ title: 'Both fields are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    await saveGoogleCredentials(clientId.trim(), clientSecret.trim());
    setSaving(false);
    toast({ title: 'Credentials saved', description: 'Click "Connect" to authorize.' });
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncGoogleCalendar();
      if (result) {
        toast({
          title: `Synced ${result.synced.length} events`,
          description: result.total > result.synced.length
            ? `${result.total - result.synced.length} all-day or out-of-range events skipped`
            : undefined,
        });
      }
    } catch {
      toast({ title: 'Sync failed', variant: 'destructive' });
    }
    setSyncing(false);
  };

  const isConnected = googleCalendar.connected;
  const hasCreds = googleCalendar.hasCredentials;

  return (
    <Card className="p-3 sm:p-4 max-w-2xl">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <div className="size-8 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
          <Calendar className="size-4 text-sky-600 dark:text-sky-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">Google Calendar</h3>
          <p className="text-[11px] text-muted-foreground truncate">Sync your calendar events to the timeline</p>
        </div>
        {isConnected && (
          <Badge variant="outline" className="text-[10px] shrink-0 border-sky-500/30 text-sky-600 dark:text-sky-400">
            <CheckCircle2 className="size-3 mr-0.5" /> Connected
          </Badge>
        )}
      </div>

      <div className="space-y-3 sm:space-y-4">
        {/* Step 1: OAuth credentials */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <span className={cn('size-5 rounded-full flex items-center justify-center text-[10px] font-bold',
              hasCreds ? 'bg-sky-500 text-white' : 'bg-muted text-muted-foreground'
            )}>1</span>
            API Credentials
          </h4>
          <p className="text-[11px] text-muted-foreground mb-2">
            Create an OAuth 2.0 client in the{' '}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-600 dark:text-sky-400 underline underline-offset-2 inline-flex items-center gap-0.5"
            >
              Google Cloud Console <ExternalLink className="size-2.5" />
            </a>{' '}
            with redirect URI <code className="text-[10px] bg-muted px-1 rounded">/api/google-calendar/callback</code>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Client ID</label>
              <Input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="your-client-id.apps.googleusercontent.com"
                className="h-8 text-[11px] font-mono"
                disabled={isConnected}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Client Secret</label>
              <div className="relative">
                <Input
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  type={showSecret ? 'text' : 'password'}
                  placeholder="GOCSPX-..."
                  className="h-8 text-[11px] font-mono pr-8"
                  disabled={isConnected}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showSecret ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                </button>
              </div>
            </div>
          </div>
          {!isConnected && (
            <Button
              size="sm"
              className="h-7 text-[11px] mt-2"
              onClick={() => void handleSaveCredentials()}
              disabled={saving || !clientId.trim() || !clientSecret.trim()}
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : null}
              {hasCreds ? 'Update Credentials' : 'Save Credentials'}
            </Button>
          )}
        </div>

        {/* Divider */}
        {hasCreds && (
          <div className="border-t" />
        )}

        {/* Step 2: Connect / Sync */}
        {hasCreds && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <span className={cn('size-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                isConnected ? 'bg-sky-500 text-white' : 'bg-muted text-muted-foreground'
              )}>2</span>
              Connection
            </h4>

            {isConnected ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px]">
                  <CheckCircle2 className="size-3.5 text-sky-500 shrink-0" />
                  <span className="text-muted-foreground">
                    Linked as <span className="font-medium text-foreground">{googleCalendar.calendarEmail}</span>
                  </span>
                </div>
                {googleCalendar.lastSyncAt && (
                  <p className="text-[10px] text-muted-foreground">
                    Last synced: {new Date(googleCalendar.lastSyncAt).toLocaleString()}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => void handleSync()}
                    disabled={syncing}
                  >
                    {syncing ? <Loader2 className="size-3 animate-spin mr-1" /> : <RefreshCw className="size-3 mr-1" />}
                    Sync Now
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] text-destructive hover:text-destructive"
                    onClick={() => void disconnectGoogleCalendar()}
                  >
                    <Unlink className="size-3 mr-1" /> Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => void connectGoogleCalendar()}
              >
                <Link2 className="size-3 mr-1" /> Connect Google Calendar
              </Button>
            )}
          </div>
        )}

        {/* Help section */}
        <div className="rounded-md border bg-muted/30 p-2.5">
          <div className="flex items-start gap-1.5">
            <AlertCircle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-[11px] text-muted-foreground space-y-1">
              <p><strong>Setup guide:</strong></p>
              <ol className="list-decimal list-inside space-y-0.5 pl-1">
                <li>Go to Google Cloud Console → APIs &amp; Services → Credentials</li>
                <li>Create &quot;OAuth 2.0 Client ID&quot; (Web application)</li>
                <li>Add authorized redirect URI: <code className="bg-muted px-1 rounded text-[10px]">http://localhost:3000/api/google-calendar/callback</code></li>
                <li>Enable the &quot;Google Calendar API&quot; under APIs &amp; Services → Library</li>
                <li>Paste Client ID &amp; Secret above, then click Connect</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
