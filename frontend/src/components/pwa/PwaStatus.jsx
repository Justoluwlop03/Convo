import { Bell, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { useChat } from '../../context/ChatContext'
import { syncAppBadge } from '../../services/appBadge'
import { canRequestNotificationPermission, requestNotificationPermission } from '../../services/messageNotifications'

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export default function PwaStatus() {
  const isOnline = useOnlineStatus()
  const { chats } = useChat()
  const [canEnableNotifications, setCanEnableNotifications] = useState(false)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  const unreadCount = useMemo(() => chats.reduce((total, chat) => total + (chat.unreadCount || 0), 0), [chats])

  useEffect(() => {
    setCanEnableNotifications(isStandalone() && canRequestNotificationPermission())
  }, [])

  const enableNotifications = async () => {
    const granted = await requestNotificationPermission()
    setCanEnableNotifications(false)
    if (granted) syncAppBadge(unreadCount)
  }

  return (
    <div className="pwa-notices" aria-live="polite">
      {!isOnline && <div className="pwa-notice offline-notice">You're offline. Messages will be queued.</div>}
      {canEnableNotifications && (
        <div className="pwa-notice">
          <span>Enable message alerts and app icon badges.</span>
          <button type="button" onClick={enableNotifications}><Bell size={14} /> Enable</button>
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
