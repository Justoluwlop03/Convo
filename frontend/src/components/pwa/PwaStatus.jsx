import { Download, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

export default function PwaStatus() {
  const isOnline = useOnlineStatus()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('convo-install-dismissed') === 'true')
  const [isInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  const dismissInstall = () => {
    localStorage.setItem('convo-install-dismissed', 'true')
    setDismissed(true)
  }

  return (
    <div className="pwa-notices" aria-live="polite">
      {!isOnline && <div className="pwa-notice offline-notice">You're offline. Messages will be queued.</div>}
      {needRefresh && (
        <div className="pwa-notice">
          <span>A new version is available.</span>
          <button type="button" onClick={() => updateServiceWorker(true)}><RefreshCw size={14} /> Refresh</button>
        </div>
      )}
      {!isInstalled && !dismissed && deferredPrompt && (
        <div className="pwa-notice install-notice">
          <span>Install Convo for quicker access.</span>
          <button type="button" onClick={install}><Download size={14} /> Install</button>
          <button type="button" className="notice-dismiss" onClick={dismissInstall} aria-label="Dismiss install prompt">×</button>
        </div>
      )}
    </div>
  )
}
