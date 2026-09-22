import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',
      // Enable the service worker on localhost too, so the install flow can
      // be tested with `npm run dev` rather than only after deployment.
      devOptions: {
        enabled: true,
        type: 'module',
      },
      includeAssets: ['icons/convo-icon.svg', 'icons/convo-icon-192.png', 'icons/convo-icon-512.png'],
      manifest: {
        name: 'Convo',
        short_name: 'Convo',
        description: 'A simple real-time chat application',
        id: '/',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        icons: [
          { src: 'icons/convo-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/convo-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
})
