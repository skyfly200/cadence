<template>
  <Card class="p-3 sm:p-4 max-w-2xl">
    <div class="flex items-center gap-2 mb-3 sm:mb-4">
      <div class="size-8 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
        <Calendar class="size-4 text-sky-600 dark:text-sky-400" />
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="text-sm font-semibold">Google Calendar</h3>
        <p class="text-[11px] text-muted-foreground truncate">Sync your calendar events to the timeline</p>
      </div>
      <Badge v-if="gcal.connected" variant="outline" class="text-[10px] shrink-0 border-sky-500/30 text-sky-600 dark:text-sky-400">
        <CheckCircle2 class="size-3" /> Connected
      </Badge>
    </div>

    <div class="space-y-3 sm:space-y-4">
      <div v-if="gcal.connected">
        <div class="flex items-center gap-2 text-[11px] mb-2">
          <CheckCircle2 class="size-3.5 text-sky-500 shrink-0" />
          <span class="text-muted-foreground">Linked as <span class="font-medium text-foreground">{{ gcal.calendarEmail }}</span></span>
        </div>
        <p v-if="gcal.lastSyncAt" class="text-[10px] text-muted-foreground mb-2">Last synced: {{ new Date(gcal.lastSyncAt).toLocaleString() }}</p>
        <div class="flex flex-wrap gap-1.5">
          <Button size="sm" class="h-7 text-[11px]" :disabled="syncing" @click="handleSync">
            <Loader2 v-if="syncing" class="size-3 animate-spin" /><RefreshCw v-else class="size-3" /> Sync Now
          </Button>
          <Button size="sm" variant="outline" class="h-7 text-[11px] text-destructive hover:text-destructive" @click="store.disconnectGoogleCalendar()">
            <Unlink class="size-3" /> Disconnect
          </Button>
        </div>
      </div>

      <div v-else-if="gcal.hasCredentials" class="space-y-2">
        <p class="text-[11px] text-muted-foreground">Google Calendar API is configured. Click below to authorize access.</p>
        <Button size="sm" class="h-7 text-[11px]" @click="store.connectGoogleCalendar()">
          <Calendar class="size-3" /> Connect Google Calendar
        </Button>
      </div>

      <div v-else class="rounded-md border bg-muted/30 p-2.5">
        <div class="flex items-start gap-1.5">
          <AlertCircle class="size-3.5 text-amber-500 shrink-0 mt-0.5" />
          <div class="text-[11px] text-muted-foreground space-y-1">
            <p><strong>Setup required</strong></p>
            <ol class="list-decimal list-inside space-y-0.5 pl-1">
              <li>Go to
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer"
                   class="text-sky-600 dark:text-sky-400 underline underline-offset-2 inline-flex items-center gap-0.5">
                  Google Cloud Console <ExternalLink class="size-2.5" />
                </a>
              </li>
              <li>Create "OAuth 2.0 Client ID" (Web application)</li>
              <li>Enable "Google Calendar API" under APIs &amp; Services → Library</li>
              <li>Set environment variables:
                <code class="block bg-muted px-1.5 py-1 rounded mt-1 text-[10px] font-mono">
                  GOOGLE_CLIENT_ID=your-client-id<br />
                  GOOGLE_CLIENT_SECRET=your-secret
                </code>
              </li>
              <li>Restart the app, then click Connect</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Calendar, Unlink, RefreshCw, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from 'lucide-vue-next';
import { useAppStore } from '~/stores/app';
import { useToast } from '~/composables/useToast';
import { saveGoogleCalendar } from '~/lib/local-storage';

const store = useAppStore();
const { toast } = useToast();
const syncing = ref(false);
const gcal = computed(() => store.googleCalendar);

onMounted(() => {
  store.loadGoogleCalendarStatus();

  // OAuth callback tokens from URL fragment
  const hash = window.location.hash;
  if (hash.startsWith('#gcal_tokens=')) {
    try {
      const tokenB64 = hash.slice('#gcal_tokens='.length);
      const json = atob(tokenB64.replace(/-/g, '+').replace(/_/g, '/'));
      const tokenData = JSON.parse(json);
      saveGoogleCalendar({
        connected: true,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        calendarEmail: tokenData.calendar_email || null,
        lastSyncAt: null,
      });
      store.loadGoogleCalendarStatus();
      toast({ title: 'Google Calendar connected!', description: 'Syncing today’s events…' });
      window.history.replaceState({}, '', '/');
      // Pull events immediately so connecting actually surfaces value.
      void store.syncGoogleCalendar();
    } catch (e) {
      console.error('Failed to parse OAuth tokens:', e);
      toast({ title: 'Connection failed', variant: 'destructive' });
      window.history.replaceState({}, '', '/');
    }
  }

  const params = new URLSearchParams(window.location.search);
  const gcalError = params.get('gcal_error');
  if (gcalError) {
    toast({ title: 'Connection failed', description: decodeURIComponent(gcalError).replace(/_/g, ' '), variant: 'destructive' });
    window.history.replaceState({}, '', '/');
  }
});

async function handleSync() {
  syncing.value = true;
  try {
    const result = await store.syncGoogleCalendar();
    if (result) {
      toast({
        title: `Synced ${result.synced} event${result.synced !== 1 ? 's' : ''}`,
        description: result.total > result.synced ? `${result.total - result.synced} all-day or out-of-range events skipped` : undefined,
      });
    }
  } catch {
    toast({ title: 'Sync failed', variant: 'destructive' });
  }
  syncing.value = false;
}
</script>
