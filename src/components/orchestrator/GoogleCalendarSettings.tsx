'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Unlink, RefreshCw, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function GoogleCalendarSettings() {
  const googleCalendar = useAppStore((s) => s.googleCalendar);
  const loadGoogleCalendarStatus = useAppStore((s) => s.loadGoogleCalendarStatus);
  const connectGoogleCalendar = useAppStore((s) => s.connectGoogleCalendar);
  const disconnectGoogleCalendar = useAppStore((s) => s.disconnectGoogleCalendar);
  const syncGoogleCalendar = useAppStore((s) => s.syncGoogleCalendar);
  const { toast } = useToast();

  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadGoogleCalendarStatus();
  }, [loadGoogleCalendarStatus]);

  // Handle OAuth callback tokens from URL fragment
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#gcal_tokens=')) return;

    try {
      const tokenB64 = hash.slice('#gcal_tokens='.length);
      const tokenData = JSON.parse(Buffer.from(tokenB64, 'base64url').toString());

      // Store tokens in localStorage via the store
      import('@/lib/local-storage').then(({ saveGoogleCalendar }) => {
        saveGoogleCalendar({
          connected: true,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          calendarEmail: tokenData.calendar_email || null,
          lastSyncAt: null,
        });
        loadGoogleCalendarStatus();
        toast({ title: 'Google Calendar connected!', description: 'Your calendar is now linked.' });
      });

      // Clean URL hash
      window.history.replaceState({}, '', '/');
    } catch (e) {
      console.error('Failed to parse OAuth tokens:', e);
      toast({ title: 'Connection failed', variant: 'destructive' });
      window.history.replaceState({}, '', '/');
    }
  }, [toast, loadGoogleCalendarStatus]);

  // Check for error params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gcalError = params.get('gcal_error');
    if (gcalError) {
      toast({
        title: 'Connection failed',
        description: decodeURIComponent(gcalError).replace(/_/g, ' '),
        variant: 'destructive',
      });
      window.history.replaceState({}, '', '/');
    }
  }, [toast]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncGoogleCalendar();
      if (result) {
        toast({
          title: `Synced ${result.synced} event${result.synced !== 1 ? 's' : ''}`,
          description: result.total > result.synced
            ? `${result.total - result.synced} all-day or out-of-range events skipped`
            : undefined,
        });
      }
    } catch {
      toast({ title: 'Sync failed', variant: 'destructive' });
    }
    setSyncing(false);
  };

  const isConnected = googleCalendar.connected;
  const hasClientId = googleCalendar.hasCredentials;

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
        {isConnected ? (
          /* Connected state */
          <div>
            <div className="flex items-center gap-2 text-[11px] mb-2">
              <CheckCircle2 className="size-3.5 text-sky-500 shrink-0" />
              <span className="text-muted-foreground">
                Linked as <span className="font-medium text-foreground">{googleCalendar.calendarEmail}</span>
              </span>
            </div>
            {googleCalendar.lastSyncAt && (
              <p className="text-[10px] text-muted-foreground mb-2">
                Last synced: {new Date(googleCalendar.lastSyncAt).toLocaleString()}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" className="h-7 text-[11px]" onClick={() => void handleSync()} disabled={syncing}>
                {syncing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                Sync Now
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] text-destructive hover:text-destructive" onClick={() => void disconnectGoogleCalendar()}>
                <Unlink className="size-3 mr-1" /> Disconnect
              </Button>
            </div>
          </div>
        ) : hasClientId ? (
          /* Has credentials — show connect button */
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Google Calendar API is configured. Click below to authorize access.
            </p>
            <Button size="sm" className="h-7 text-[11px]" onClick={() => connectGoogleCalendar()}>
              <Calendar className="size-3 mr-1" /> Connect Google Calendar
            </Button>
          </div>
        ) : (
          /* Not configured — show setup instructions */
          <div className="rounded-md border bg-muted/30 p-2.5">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[11px] text-muted-foreground space-y-1">
                <p><strong>Setup required</strong></p>
                <ol className="list-decimal list-inside space-y-0.5 pl-1">
                  <li>Go to{' '}
                    <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer"
                       className="text-sky-600 dark:text-sky-400 underline underline-offset-2 inline-flex items-center gap-0.5">
                      Google Cloud Console <ExternalLink className="size-2.5" />
                    </a>
                  </li>
                  <li>Create &quot;OAuth 2.0 Client ID&quot; (Web application)</li>
                  <li>Enable &quot;Google Calendar API&quot; under APIs &amp; Services → Library</li>
                  <li>Set environment variables:
                    <code className="block bg-muted px-1.5 py-1 rounded mt-1 text-[10px] font-mono">
                      GOOGLE_CLIENT_ID=your-client-id<br />
                      GOOGLE_CLIENT_SECRET=your-secret
                    </code>
                  </li>
                  <li>Restart the app, then click Connect</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
