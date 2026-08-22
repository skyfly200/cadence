import tailwindcss from '@tailwindcss/vite';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  ssr: true,

  modules: ['@pinia/nuxt', '@vueuse/nuxt', '@nuxtjs/color-mode', '@vite-pwa/nuxt'],

  components: [{ path: '~/components', pathPrefix: false }],

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Cadence',
      short_name: 'Cadence',
      description: 'Capacity-aware daily planner: timeline, habits, triage, and process-based scoring.',
      theme_color: '#a855f7',
      background_color: '#ffffff',
      display: 'standalone',
      id: '/',
      start_url: '/',
      orientation: 'portrait-primary',
      categories: ['productivity', 'lifestyle'],
      icons: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}'],
      // Cache-first for same-origin assets; app data is localStorage so it's
      // already offline. AI/Calendar API calls simply fail gracefully offline.
      runtimeCaching: [
        {
          urlPattern: ({ sameOrigin, request }: { sameOrigin: boolean; request: Request }) =>
            sameOrigin && request.destination !== '',
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'cadence-assets' },
        },
        {
          // OSM map tiles — cache what's viewed (and what "Save area offline"
          // pre-fetches) so maps work offline for places you've looked at.
          urlPattern: ({ url }: { url: URL }) => url.hostname.endsWith('tile.openstreetmap.org'),
          handler: 'CacheFirst',
          options: {
            cacheName: 'osm-tiles',
            expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
    client: { installPrompt: true },
    devOptions: { enabled: false },
  },

  css: ['~/assets/css/main.css', 'leaflet/dist/leaflet.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  colorMode: {
    classSuffix: '',
    preference: 'light',
    fallback: 'light',
  },

  app: {
    head: {
      title: 'Cadence',
      link: [
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'Cadence' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        {
          name: 'description',
          content:
            'Capacity-aware daily planner with resilient timers, drag-and-drop timeline, and process-based gamification.',
        },
        { name: 'theme-color', content: '#ffffff', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#09090b', media: '(prefers-color-scheme: dark)' },
      ],
    },
  },

  runtimeConfig: {
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    public: {
      googleClientId: process.env.NUXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || 'https://wgdjwzlqvpvltedzasga.supabase.co',
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_5mdrxPgP4XBxsbIh2t1jQg_eqvTSuKM',
    },
  },

  typescript: {
    typeCheck: false,
  },
});
