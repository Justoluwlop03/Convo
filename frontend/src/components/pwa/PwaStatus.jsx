import { Bell, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { useChat } from '../../context/ChatContext'
import { canRequestAppBadgePermission, requestAppBadgePermission, syncAppBadge } from '../../services/appBadge'

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export default function PwaStatus() {
  const isOnline = useOnlineStatus()
  const { chats } = useChat()
  const [canEnableBadges, setCanEnableBadges] = useState(false)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const unreadCount = useMemo(() => chats.reduce((total, chat) => total + (chat.unreadCount || 0), 0), [chats])

  useEffect(() => {
    setCanEnableBadges(isStandalone() && canRequestAppBadgePermission())
  }, [])

  const enableBadges = async () => {
    const granted = await requestAppBadgePermission()
    setCanEnableBadges(false)
    if (granted) syncAppBadge(unreadCount)
  }

  return (
    <div className="pwa-notices" aria-live="polite">
      {!isOnline && <div className="pwa-notice offline-notice">You're offline. Messages will be queued.</div>}
      {canEnableBadges && (
        <div className="pwa-notice">
          <span>Enable app icon badges for unread messages.</span>
          <button type="button" onClick={enableBadges}><Bell size={14} /> Enable</button>
        </div>
      )}
      {needRefresh && (
        <div className="pwa-notice">
          <span>A new version is available.</span>
          <button type="button" onClick={() => updateServiceWorker(true)}><RefreshCw size={14} /> Refresh</button>
        </div>
      )}
    </div>
  )
}
