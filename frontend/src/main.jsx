import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Chrome can fire this event before the authenticated app layout mounts. Keep
// the deferred prompt globally so the Install button can use it later.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  window.__convoInstallPrompt = event
  window.dispatchEvent(new Event('convo-install-prompt-ready'))
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.ready.catch(() => {}))
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
