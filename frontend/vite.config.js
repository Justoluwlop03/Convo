import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    // Use a stable development origin that is separate from any old
    // localhost service-worker scope.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      // Do not cache localhost assets. Development styles and modules should
      // update immediately; PWA caching remains enabled in production builds.
      devOptions: {
        enabled: false,
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
