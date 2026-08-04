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
      start_url: '/',
      icons: [
        { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
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
      ],
    },
    client: { installPrompt: true },
    devOptions: { enabled: false },
  },

  css: ['~/assets/css/main.css'],

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
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
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
    },
  },

  typescript: {
    typeCheck: false,
  },
});
