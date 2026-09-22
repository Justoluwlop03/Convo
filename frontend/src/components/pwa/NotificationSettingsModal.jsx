import { Bell, BellOff, Eye, EyeOff, X } from 'lucide-react'
import { useState } from 'react'
import { useChat } from '../../context/ChatContext'

export default function NotificationSettingsModal({ onClose }) {
  const { chats, notificationSettings, updateNotifications } = useChat()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const muted = new Set(notificationSettings.mutedConversationIds)

  const save = async (patch) => {
    setBusy(true); setError('')
    try { await updateNotifications({ ...notificationSettings, ...patch }) } catch (err) { setError(err.response?.data?.message || 'Unable to save notification settings.') } finally { setBusy(false) }
  }
  const toggleMute = id => save({ mutedConversationIds: muted.has(id) ? [...muted].filter(value => value !== id) : [...muted, id] })

  return <div className="group-modal-layer" onClick={onClose}><section className="group-modal notification-settings" onClick={event => event.stopPropagation()}><div className="group-modal-heading"><div><h2>Notifications</h2><p>Choose which unread messages can alert you.</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></div><label className="notification-setting"><span><Bell size={17}/><strong>Message alerts</strong><small>Show alerts for unread messages.</small></span><input type="checkbox" checked={notificationSettings.alertsEnabled} disabled={busy} onChange={event => save({ alertsEnabled: event.target.checked })}/></label><label className="notification-setting"><span>{notificationSettings.showPreview ? <Eye size={17}/> : <EyeOff size={17}/>}<strong>Message previews</strong><small>Include message text in alerts.</small></span><input type="checkbox" checked={notificationSettings.showPreview} disabled={busy || !notificationSettings.alertsEnabled} onChange={event => save({ showPreview: event.target.checked })}/></label><h3>Muted conversations</h3><div className="notification-conversations">{chats.map(chat => <label key={chat.id} className="notification-conversation"><span>{chat.type === 'group' ? chat.name : chat.participant.username}</span><button type="button" className="ghost-button" disabled={busy} onClick={() => toggleMute(chat.id)}>{muted.has(chat.id) ? <><BellOff size={15}/>Muted</> : <><Bell size={15}/>Alerting</>}</button></label>)}</div>{error && <p className="inline-error">{error}</p>}</section></div>
}
