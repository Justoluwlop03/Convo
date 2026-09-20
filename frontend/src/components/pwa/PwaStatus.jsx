import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

export default function PwaStatus() {
  const isOnline = useOnlineStatus()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  return (
    <div className="pwa-notices" aria-live="polite">
      {!isOnline && <div className="pwa-notice offline-notice">You're offline. Messages will be queued.</div>}
      {needRefresh && (
        <div className="pwa-notice">
          <span>A new version is available.</span>
          <button type="button" onClick={() => updateServiceWorker(true)}><RefreshCw size={14} /> Refresh</button>
        </div>
      )}
    </div>
  )
}
