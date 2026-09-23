import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/message-actions.css'
import './styles/status-stories.css'
import App from './App.jsx'

// Chrome can fire this event before the authenticated app layout mounts. Keep
// the deferred prompt globally so the Install button can use it later.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  window.__convoInstallPrompt = event
  window.dispatchEvent(new Event('convo-install-prompt-ready'))
})

if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    // A service worker previously enabled for localhost can continue serving
    // an old bundle even after the PWA dev setting is turned off. Remove only
    // PWA-related caches in development; production registrations are intact.
    window.addEventListener('load', async () => {
      const wasControlled = Boolean(navigator.serviceWorker.controller)
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(registration => registration.unregister()))
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.filter(name => /workbox|vite.*pwa|pwa.*vite/i.test(name)).map(name => caches.delete(name)))
      }
      if (wasControlled) window.location.reload()
    })
  } else {
    window.addEventListener('load', () => navigator.serviceWorker.ready.catch(() => {}))
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
