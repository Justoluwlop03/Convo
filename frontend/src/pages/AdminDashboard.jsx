import { Activity, ArrowDownRight, ArrowUpRight, Ban, ArrowLeft, ArrowRight, CheckCircle2, CircleHelp, Clock3, Database, Mail, MessageSquare, RefreshCw, Search, SearchX, Send, Server, ShieldCheck, Trash2, Users, UserRoundCheck, Wifi } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import './AdminDashboard.css'

const empty = { system: {}, metrics: {}, activity: [], recentUsers: [] }
const prettyUptime = (seconds = 0) => `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
const dateLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })

export default function AdminDashboard() {
  const [data, setData] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState(null)
  const [managedUsers, setManagedUsers] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userPages, setUserPages] = useState(1)
  const [userTotal, setUserTotal] = useState(0)
  const [userLoading, setUserLoading] = useState(true)
  const [userError, setUserError] = useState('')
  const [userActionId, setUserActionId] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [broadcastSubject, setBroadcastSubject] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcasts, setBroadcasts] = useState([])
  const [broadcastSending, setBroadcastSending] = useState(false)
  const [broadcastError, setBroadcastError] = useState('')
  const [broadcastNotice, setBroadcastNotice] = useState('')
  const [broadcastHistoryError, setBroadcastHistoryError] = useState('')
  const [deletingBroadcastId, setDeletingBroadcastId] = useState('')
  const refresh = useCallback(async () => {
    try {
      const response = await api.get('/admin/overview')
      setData(response.data)
      setUpdated(new Date())
      setError('')
    } catch (requestError) {
      if (requestError.response?.status === 403) setNotFound(true)
      setError(requestError.response?.data?.message || 'Unable to load monitoring data. Check that the API is online.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => {
    refresh()
    const interval = window.setInterval(refresh, 30000)
    return () => window.clearInterval(interval)
  }, [refresh])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(async () => {
      setUserLoading(true)
      try {
        const response = await api.get('/admin/users', { params: { search: userSearch, page: userPage, limit: 25 } })
        if (!active) return
        setManagedUsers(response.data.users)
        setUserTotal(response.data.total)
        setUserPages(response.data.pages)
        setUserError('')
      } catch (requestError) {
        if (active && requestError.response?.status === 403) setNotFound(true)
        else if (active) setUserError(requestError.response?.data?.message || 'Could not load users.')
      } finally {
        if (active) setUserLoading(false)
      }
    }, userSearch ? 250 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [userSearch, userPage])

  const toggleBan = async (user) => {
    const nextBanned = !user.isBanned
    if (nextBanned && !window.confirm(`Ban ${user.displayName || user.username}? They will be signed out and unable to use the app until unbanned.`)) return
    setUserActionId(user.id)
    setUserError('')
    try {
      await api.patch(`/admin/users/${user.id}/ban`, { isBanned: nextBanned })
      setManagedUsers(current => current.map(item => item.id === user.id ? { ...item, isBanned: nextBanned, online: false } : item))
      refresh()
    } catch (requestError) {
      setUserError(requestError.response?.data?.message || 'Could not update this account.')
    } finally { setUserActionId('') }
  }

  const loadBroadcasts = useCallback(async () => {
    try {
      const response = await api.get('/admin/broadcasts')
      setBroadcasts(response.data.broadcasts)
    } catch (requestError) {
      if (requestError.response?.status === 403) setNotFound(true)
    }
  }, [])

  useEffect(() => {
    loadBroadcasts()
    const interval = window.setInterval(loadBroadcasts, 10000)
    return () => window.clearInterval(interval)
  }, [loadBroadcasts])

  const sendBroadcast = async (event) => {
    event.preventDefault()
    const recipientCount = data.metrics.users || 0
    if (!recipientCount || !window.confirm(`Send this email to all ${recipientCount} user accounts? This cannot be recalled.`)) return
    setBroadcastSending(true)
    setBroadcastError('')
    setBroadcastNotice('')
    try {
      const response = await api.post('/admin/broadcasts', { subject: broadcastSubject, message: broadcastMessage })
      setBroadcasts(current => [response.data.broadcast, ...current].slice(0, 10))
      setBroadcastSubject('')
      setBroadcastMessage('')
      setBroadcastNotice(`Broadcast queued for ${response.data.broadcast.recipientsCount.toLocaleString()} recipients.`)
      loadBroadcasts()
    } catch (requestError) {
      if (requestError.response?.status === 403) setNotFound(true)
      setBroadcastError(requestError.response?.data?.message || 'Unable to queue the email broadcast.')
    } finally { setBroadcastSending(false) }
  }

  const deleteBroadcast = async (broadcast) => {
    if (!window.confirm(`Delete “${broadcast.subject}” from broadcast history? Emails already sent cannot be recalled.`)) return
    setDeletingBroadcastId(broadcast.id)
    setBroadcastHistoryError('')
    try {
      await api.delete(`/admin/broadcasts/${broadcast.id}`)
      setBroadcasts(current => current.filter(item => item.id !== broadcast.id))
    } catch (requestError) {
      setBroadcastHistoryError(requestError.response?.data?.message || 'Unable to delete this broadcast record.')
    } finally { setDeletingBroadcastId('') }
  }

  const maxActivity = useMemo(() => Math.max(1, ...data.activity.map(day => day.count)), [data.activity])
  const cards = [
    { label: 'Total users', value: data.metrics.users, detail: `${data.metrics.newUsers || 0} joined this week`, Icon: Users, color: 'violet' },
    { label: 'Online now', value: data.metrics.onlineUsers, detail: `${data.system.sockets || 0} live connections`, Icon: Wifi, color: 'green' },
    { label: 'Messages', value: data.metrics.messages, detail: 'All conversations', Icon: MessageSquare, color: 'blue' },
    { label: 'Conversations', value: (data.metrics.chats || 0) + (data.metrics.groups || 0), detail: `${data.metrics.chats || 0} chats · ${data.metrics.groups || 0} groups`, Icon: Activity, color: 'orange' },
  ]

  if (notFound) return <section className="admin-page admin-not-found-page"><div className="admin-not-found-card"><span className="admin-not-found-icon"><SearchX size={26}/></span><p className="admin-not-found-code">404 · PAGE NOT FOUND</p><h2>Nothing to see here</h2><p>The page you’re looking for doesn’t exist.</p><Link to="/" className="admin-not-found-link"><ArrowLeft size={16}/> Back to messages</Link></div></section>

  return <section className="admin-page">
    <div className="admin-heading">
      <div><span className="admin-kicker"><ShieldCheck size={14}/> CONVO CONTROL CENTER</span><h2>Admin dashboard</h2><p>Monitor service health and activity across your app.</p></div>
      <div className="admin-heading-actions"><span className="admin-updated">{updated ? `Updated ${updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for data'}</span><button className="admin-refresh" onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading ? 'admin-spinning' : ''}/> Refresh</button></div>
    </div>
    {error && <div className="admin-error"><CircleHelp size={18}/><div><strong>{error.includes('allowlist') ? 'Admin access required' : 'Monitoring data unavailable'}</strong><span>{error}</span></div></div>}
    <div className="admin-status-row">
      <div className="admin-service-status"><span className={`admin-status-dot ${data.system.api === 'operational' ? 'is-up' : ''}`}/><div><strong>API service</strong><small>{data.system.api === 'operational' ? 'Operational' : loading ? 'Checking status' : 'Unavailable'}</small></div></div>
      <div className="admin-service-status"><Database size={18}/><div><strong>Database</strong><small>{data.system.database || 'Checking status'}</small></div></div>
      <div className="admin-service-status"><Server size={18}/><div><strong>Runtime</strong><small>{data.system.environment || '—'} · {prettyUptime(data.system.uptimeSeconds)}</small></div></div>
      <div className="admin-service-status"><Wifi size={18}/><div><strong>Memory</strong><small>{data.system.memoryMb || '—'} MB in use</small></div></div>
    </div>
    <div className="admin-metric-grid">{cards.map(({ label, value, detail, Icon, color }) => <article className="admin-metric-card" key={label}><div className={`admin-metric-icon ${color}`}><Icon size={18}/></div><span className="admin-metric-label">{label}</span><strong className="admin-metric-value">{loading && !updated ? '—' : Number(value || 0).toLocaleString()}</strong><span className="admin-metric-detail">{detail}</span></article>)}</div>
    <div className="admin-content-grid">
      <article className="admin-panel activity-panel"><div className="admin-panel-title"><div><h3>Message activity</h3><p>Messages sent over the last 7 days</p></div><span className="admin-panel-badge"><ArrowUpRight size={14}/> 7 days</span></div>
        <div className="admin-chart" role="img" aria-label="Message activity during the last seven days">{data.activity.map(day => <div className="admin-chart-column" key={day.date}><span className="admin-chart-count">{day.count.toLocaleString()}</span><div className="admin-chart-track"><div className="admin-chart-bar" style={{ height: `${Math.max(4, day.count / maxActivity * 100)}%` }}/></div><span className="admin-chart-day">{dateLabel(day.date)}</span></div>)}</div>
        {!data.activity.length && <div className="admin-chart-empty">Activity will appear here once the API is connected.</div>}
      </article>
      <article className="admin-panel"><div className="admin-panel-title"><div><h3>Latest signups</h3><p>Most recently created accounts</p></div><span className="admin-panel-badge"><Clock3 size={14}/> Recent</span></div>
        <div className="admin-user-list">{data.recentUsers.map(user => <div className="admin-user-row" key={user.id}><div className="admin-user-avatar">{user.avatar ? <img src={user.avatar} alt=""/> : (user.displayName || user.username || '?').slice(0, 1).toUpperCase()}</div><div className="admin-user-copy"><strong>{user.displayName || user.username}</strong><span>{user.email}</span></div><div className="admin-user-meta"><span className={user.online ? 'online' : ''}>{user.online ? 'Online' : 'Offline'}</span><small>{new Date(user.createdAt).toLocaleDateString()}</small></div></div>)}{!data.recentUsers.length && <div className="admin-list-empty">New user registrations will show here.</div>}</div>
      </article>
    </div>
    <section className="admin-panel admin-user-management">
      <div className="admin-panel-title"><div><h3>User management</h3><p>{userTotal.toLocaleString()} accounts · ban or restore access</p></div><span className="admin-panel-badge"><Users size={14}/> Accounts</span></div>
      <label className="admin-user-search"><Search size={16}/><input value={userSearch} onChange={(event) => { setUserSearch(event.target.value); setUserPage(1) }} placeholder="Search username, name, or email" /><span>Search</span></label>
      {userError && <p className="admin-user-error" role="alert">{userError}</p>}
      <div className="admin-managed-list">
        {userLoading && !managedUsers.length ? <div className="admin-list-empty">Loading accounts…</div> : managedUsers.map(user => <div className={`admin-managed-user ${user.isBanned ? 'is-banned' : ''}`} key={user.id}>
          <div className="admin-user-avatar">{user.avatar ? <img src={user.avatar} alt=""/> : (user.displayName || user.username || '?').slice(0, 1).toUpperCase()}</div>
          <div className="admin-user-copy"><strong>{user.displayName || user.username}</strong><span>{user.email}</span></div>
          <span className={`admin-account-state ${user.isBanned ? 'banned' : user.online ? 'online' : ''}`}>{user.isAdmin ? 'Admin' : user.isBanned ? 'Banned' : user.online ? 'Online' : 'Active'}</span>
          {user.isAdmin ? <span className="admin-protected-label"><ShieldCheck size={14}/> Protected</span> : <button className={`admin-ban-button ${user.isBanned ? 'unban' : ''}`} onClick={() => toggleBan(user)} disabled={userActionId === user.id}>
            {user.isBanned ? <><UserRoundCheck size={14}/> Unban</> : <><Ban size={14}/> Ban</>}
          </button>}
        </div>)}
        {!userLoading && !managedUsers.length && <div className="admin-list-empty">No accounts match this search.</div>}
      </div>
      <div className="admin-user-pagination"><span>Page {userPage} of {userPages}</span><div><button aria-label="Previous page" onClick={() => setUserPage(page => Math.max(1, page - 1))} disabled={userPage <= 1 || userLoading}><ArrowLeft size={15}/></button><button aria-label="Next page" onClick={() => setUserPage(page => Math.min(userPages, page + 1))} disabled={userPage >= userPages || userLoading}><ArrowRight size={15}/></button></div></div>
    </section>
    <section className="admin-panel admin-broadcast-panel">
      <div className="admin-panel-title"><div><h3>Email broadcast</h3><p>Send an announcement to all user accounts.</p></div><span className="admin-panel-badge"><Mail size={14}/> Email</span></div>
      <div className="admin-broadcast-audience"><Users size={16}/><span>Recipients</span><strong>{Number(data.metrics.users || 0).toLocaleString()} users</strong><small>Each user receives a private email.</small></div>
      <form className="admin-broadcast-form" onSubmit={sendBroadcast}>
        <label>Subject<input value={broadcastSubject} onChange={event => setBroadcastSubject(event.target.value)} maxLength={150} placeholder="Announcement subject" required /></label>
        <label>Message<textarea value={broadcastMessage} onChange={event => setBroadcastMessage(event.target.value)} maxLength={12000} rows={6} placeholder="Write your message to users…" required /></label>
        {broadcastError && <p className="admin-user-error" role="alert">{broadcastError}</p>}
        {broadcastNotice && <p className="admin-broadcast-notice" role="status"><CheckCircle2 size={15}/>{broadcastNotice}</p>}
        <div className="admin-broadcast-submit"><span>Sending is limited to 3 broadcasts per hour.</span><button type="submit" disabled={broadcastSending || loading || !data.metrics.users}><Send size={15}/>{broadcastSending ? 'Queueing…' : 'Send broadcast'}</button></div>
      </form>
      <div className="admin-broadcast-history"><h4>Recent broadcasts</h4>{broadcastHistoryError && <p className="admin-user-error" role="alert">{broadcastHistoryError}</p>}{broadcasts.length ? broadcasts.map(item => <div className="admin-broadcast-row" key={item.id}><div className="admin-broadcast-copy"><strong>{item.subject}</strong><span>{item.sentCount.toLocaleString()} / {item.recipientsCount.toLocaleString()} sent · {new Date(item.createdAt).toLocaleString()}</span>{item.error && <small>{item.error}</small>}</div><div className="admin-broadcast-actions"><span className={`admin-broadcast-status ${item.status}`}>{item.status}</span>{['sent', 'failed'].includes(item.status) && <button className="admin-broadcast-delete" type="button" title="Delete from history" aria-label={`Delete ${item.subject} from broadcast history`} disabled={deletingBroadcastId === item.id} onClick={() => deleteBroadcast(item)}><Trash2 size={14}/></button>}</div></div>) : <p className="admin-list-empty">No broadcasts sent yet.</p>}</div>
    </section>
    <footer className="admin-footnote"><ArrowDownRight size={14}/> Dashboard refreshes every 30 seconds. User details are limited to account name and email.</footer>
  </section>
}
