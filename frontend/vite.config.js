import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // Enable the service worker on localhost too, so the install flow can
      // be tested with `npm run dev` rather than only after deployment.
      devOptions: {
        enabled: true,
        type: 'module',
      },
      includeAssets: ['icons/convo-icon.svg'],
      manifest: {
        name: 'Convo',
        short_name: 'Convo',
        description: 'A simple real-time chat application',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        icons: [
          { src: 'icons/convo-icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/convo-icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
            method: 'GET',
          },
        ],
      },
    }),
  ],
})
