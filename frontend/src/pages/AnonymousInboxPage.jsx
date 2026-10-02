import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, Copy, Flag, Inbox, LockKeyhole, MessageCircle, Send, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function AnonymousInboxPage({ publicOnly = false }) {
  const { username } = useParams()
  const { user } = useAuth()
  const [enabled, setEnabled] = useState(false)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(!publicOnly)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (publicOnly) return
    Promise.all([api.get('/anonymous-inbox/settings'), api.get('/anonymous-inbox')])
      .then(([settings, inbox]) => { setEnabled(settings.data.enabled); setMessages(inbox.data.messages) })
      .catch(() => setError('Unable to load your inbox. Please try again.'))
      .finally(() => setLoading(false))
  }, [publicOnly])

  const toggleInbox = async () => {
    setBusy(true)
    setError('')
    try {
      const { data } = await api.patch('/anonymous-inbox/settings', { enabled: !enabled })
      setEnabled(data.enabled)
      setNotice(data.enabled ? 'Your inbox is open.' : 'Your inbox is paused.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update your inbox.')
    } finally { setBusy(false) }
  }

  const send = async event => {
    event.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.post(`/anonymous-inbox/public/${encodeURIComponent(username)}`, { text })
      setText('')
      setNotice('Your message has been sent.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to send your message.')
    } finally { setBusy(false) }
  }

  const messageAction = async (message, action) => {
    setError('')
    try {
      if (action === 'delete') {
        await api.delete(`/anonymous-inbox/${message.id}`)
        setMessages(items => items.filter(item => item.id !== message.id))
      } else {
        const { data } = await api.post(`/anonymous-inbox/${message.id}/report`)
        setMessages(items => items.map(item => item.id === message.id ? data.message : item))
      }
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to update this message.') }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/ask/${user.username}`)
      setNotice('Your inbox link is copied and ready to share.')
    } catch { setError('Could not copy the link. You can copy it from your address bar.') }
  }

  if (publicOnly) return (
    <main className="inbox-public-shell">
      <div className="inbox-public-brand"><span className="inbox-brand-mark">C</span><span>CONVO</span></div>
      <section className="inbox-public-card">
        <div className="inbox-public-art"><div className="inbox-public-icon"><MessageCircle size={25}/></div><Sparkles className="inbox-sparkle" size={19}/></div>
        <p className="inbox-kicker">A note for @{username}</p>
        <h1>Say it anonymously.</h1>
        <p className="inbox-public-copy">Send a kind note, a question, or a thought. Your identity won’t be shown to the recipient.</p>
        <form className="inbox-compose" onSubmit={send}>
          <label htmlFor="anonymous-message">Your message</label>
          <textarea id="anonymous-message" value={text} onChange={event => setText(event.target.value)} maxLength={1000} rows={5} placeholder="What would you like to say?" required />
          <div className="inbox-compose-meta"><span>Keep it thoughtful and respectful.</span><span>{text.length}/1000</span></div>
          <button className="primary-button" disabled={busy || !text.trim()}><Send size={16}/>{busy ? 'Sending…' : 'Send anonymously'}</button>
        </form>
        {notice && <p className="inbox-feedback success" role="status"><Check size={16}/>{notice}</p>}
        {error && <p className="inbox-feedback error" role="alert">{error}</p>}
        <div className="inbox-privacy-note"><LockKeyhole size={15}/><span>Anonymous to @{username}</span><span className="inbox-note-divider"/><span>No account needed</span></div>
      </section>
      <p className="inbox-public-footer">A little kindness goes a long way.</p>
    </main>
  )

  return (
    <main className="inbox-page">
      <header className="inbox-heading">
        <div className="inbox-heading-icon"><Inbox size={23}/></div>
        <div className="inbox-heading-copy"><p className="inbox-kicker">Your private space</p><h1>Anonymous inbox</h1><p>Hear what people want to say, privately.</p></div>
      </header>

      {error && <p className="inbox-feedback error" role="alert">{error}</p>}
      {notice && <p className="inbox-feedback success" role="status"><Check size={16}/>{notice}</p>}

      <section className={`inbox-control-card ${enabled ? 'is-open' : ''}`}>
        <div className="inbox-control-status"><span className="inbox-status-dot"/><span>{enabled ? 'Inbox is open' : 'Inbox is paused'}</span></div>
        <h2>{enabled ? 'Your link is ready to share' : 'Open your inbox to get started'}</h2>
        <p>{enabled ? 'Anyone with your link can leave you an anonymous message.' : 'Turn on anonymous messages whenever you’re ready. You can pause them at any time.'}</p>
        <div className="inbox-control-actions">
          <button type="button" className={enabled ? 'ghost-button' : 'primary-button'} disabled={busy} onClick={toggleInbox}>{enabled ? 'Pause inbox' : 'Open inbox'}</button>
          {enabled && <button type="button" className="primary-button inbox-copy-button" onClick={copyLink}><Copy size={16}/>Copy my link</button>}
        </div>
        {enabled && <div className="inbox-share-url"><span>{window.location.origin}/ask/{user?.username}</span><button type="button" aria-label="Copy inbox link" onClick={copyLink}><Copy size={15}/></button></div>}
        <div className="inbox-safety-note"><ShieldCheck size={16}/><span>Messages are anonymous to you. You can report or delete anything you receive.</span></div>
      </section>

      <section className="inbox-messages">
        <div className="inbox-list-heading"><div><p className="inbox-kicker">The latest</p><h2>Messages</h2></div><span className="inbox-message-count">{messages.length}</span></div>
        {loading ? <div className="inbox-list-loading"><span/><span/><span/></div> : messages.length ? (
          <div className="inbox-message-list">{messages.map(message => (
            <article className="inbox-message" key={message.id}>
              <div className="inbox-anonymous-avatar"><MessageCircle size={17}/></div>
              <div className="inbox-message-content"><p>{message.text}</p><footer><time>{new Date(message.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>{message.reported && <span className="reported-label">Reported</span>}<button type="button" title="Report message" aria-label="Report message" disabled={message.reported} onClick={() => messageAction(message, 'report')}><Flag size={15}/></button><button type="button" title="Delete message" aria-label="Delete message" onClick={() => messageAction(message, 'delete')}><Trash2 size={15}/></button></footer></div>
            </article>
          ))}</div>
        ) : <div className="inbox-empty"><div className="inbox-empty-icon"><Inbox size={22}/></div><strong>No messages yet</strong><p>{enabled ? 'Share your link and your first note will land here.' : 'Open your inbox when you’re ready to receive notes.'}</p>{enabled && <button type="button" className="ghost-button" onClick={copyLink}><Copy size={15}/>Share your link</button>}</div>}
      </section>
    </main>
  )
}
