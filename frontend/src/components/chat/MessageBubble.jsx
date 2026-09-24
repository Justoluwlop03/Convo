import { AlertCircle, Check, CheckCheck, Clock3, Copy, Heart, MoreHorizontal, Pencil, Reply, SmilePlus, Tag, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import UserAvatar from '../users/UserAvatar'
import { useStories } from '../../context/StoryContext'
import VoiceMessage from './VoiceMessage'
import api from '../../services/api'

const emojiOptions = ['\u2764\uFE0F', '\u{1F602}', '\u{1F44D}', '\u{1F622}', '\u{1F62E}']

export default function MessageBubble({ message, isOwn, canModify = true, canReply = true, canTag = false, currentUserId, onReply, onEdit, onDelete, onSendSticker, onTagMessage }) {
  const { openStoryById } = useStories()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.text)
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(null)
  const [showReactions, setShowReactions] = useState(false)
  const [reaction, setReaction] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [toast, setToast] = useState('')
  const [stickerFavorite, setStickerFavorite] = useState(null)
  const rowRef = useRef(null)
  const pressTimer = useRef(null)
  const toastTimer = useRef(null)
  const statusIcon = message.status === 'pending' || message.status === 'sending' ? <Clock3 size={14} strokeWidth={2.5} /> : message.status === 'failed' ? <AlertCircle size={14} strokeWidth={2.5} /> : message.status === 'sent' ? <Check size={15} strokeWidth={2.5} /> : <CheckCheck size={15} strokeWidth={2.5} />

  const openMenu = (x, y) => {
    const menuWidth = 190
    const menuHeight = (isOwn && canModify ? 350 : 290) + (canReply ? 0 : -50)
    setMenu({ x: Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8)), y: Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8)) })
    if (message.type === 'sticker' && stickerFavorite === null) {
      api.get('/stickers').then(({ data }) => setStickerFavorite(data.favorites.includes(message.stickerId))).catch(() => setStickerFavorite(false))
    }
  }
  const clearLongPress = () => { window.clearTimeout(pressTimer.current); pressTimer.current = null }

  useEffect(() => {
    const closeOutside = event => { if (!rowRef.current?.contains(event.target) && !event.target.closest?.('.message-action-menu')) setMenu(null) }
    const closeOnScroll = () => setMenu(null)
    document.addEventListener('pointerdown', closeOutside)
    window.addEventListener('scroll', closeOnScroll, true)
    return () => { document.removeEventListener('pointerdown', closeOutside); window.removeEventListener('scroll', closeOnScroll, true); window.clearTimeout(toastTimer.current) }
  }, [])

  const copyMessage = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(message.text)
      else {
        const input = document.createElement('textarea')
        input.value = message.text
        input.style.position = 'fixed'; input.style.opacity = '0'
        document.body.appendChild(input); input.select()
        const copied = document.execCommand('copy'); input.remove()
        if (!copied) throw new Error('Copy unavailable')
      }
      setToast('Copied')
      window.clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(() => setToast(''), 1600)
    } catch { setToast('Unable to copy') }
    setMenu(null)
  }

  const saveEdit = async () => {
    const text = draft.trim()
    if (!text || text === message.text) { setEditing(false); setDraft(message.text); return }
    setBusy(true)
    try { await onEdit(message.id, text); setEditing(false) }
    catch (error) { setToast(error.response?.data?.message || error.message || 'Unable to edit message') }
    finally { setBusy(false) }
  }

  const remove = async () => {
    setBusy(true)
    try { await onDelete(message.id); setConfirmDelete(false) }
    catch (error) { setToast(error.response?.data?.message || error.message || 'Unable to delete message') }
    finally { setBusy(false) }
  }

  const toggleStickerFavorite = async () => {
    try {
      const { data } = await api.post(`/stickers/${message.stickerId}/favorite`, { favorite: !stickerFavorite })
      setStickerFavorite(data.favorites.includes(message.stickerId))
      setMenu(null)
    } catch (error) { setToast(error.response?.data?.message || 'Unable to save sticker') }
  }

  const chooseReaction = async emoji => {
    if (canTag) {
      setBusy(true)
      try { await onTagMessage(message.id, emoji) }
      catch (error) { setToast(error.response?.data?.message || error.message || 'Unable to tag this message') }
      finally { setBusy(false) }
    } else setReaction(emoji)
    setShowReactions(false)
    setMenu(null)
  }

  const groupedReactions = Object.values((message.reactions || []).reduce((groups, item) => {
    groups[item.emoji] ||= { emoji: item.emoji, count: 0, users: [] }
    groups[item.emoji].count += 1
    groups[item.emoji].users.push({ id: item.user?.id, username: item.user?.username || 'Group member' })
    return groups
  }, {}))

  return <>
    <div ref={rowRef} className={`message-row ${isOwn ? 'own' : ''}`} onContextMenu={event => { if (message.deleted) return; event.preventDefault(); openMenu(event.clientX, event.clientY) }} onTouchStart={event => { if (message.deleted) return; const touch = event.touches[0]; clearLongPress(); pressTimer.current = window.setTimeout(() => openMenu(touch.clientX, touch.clientY), 500) }} onTouchEnd={clearLongPress} onTouchCancel={clearLongPress} onTouchMove={clearLongPress}>
      {!isOwn && <UserAvatar user={message.sender} className="tiny" alt={`${message.sender?.username || 'User'}'s profile`} />}
      <div className={`message-bubble-wrap ${isOwn ? 'own' : ''}`}>
        {!message.deleted && <button type="button" className="message-menu-trigger" aria-label="Message actions" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); openMenu(rect.right, rect.top) }}><MoreHorizontal size={17}/></button>}
        <div className={`message-bubble ${isOwn ? 'own' : ''} ${message.deleted ? 'deleted' : ''} ${message.type === 'sticker' && !message.deleted ? 'sticker-message' : ''}`}>
          {message.replyTo && <div className="message-reply-preview"><strong>{message.replyTo.sender?.username || 'Message'}</strong><span>{message.replyTo.text}</span></div>}
          {message.story && <button type="button" className="message-story-preview" disabled={message.story.expired} onClick={() => openStoryById(message.story.id)}><span>{message.story.expired ? 'Status expired' : 'Replied to a status'}</span>{!message.story.expired && (message.story.mediaType === 'text' ? <strong>{message.story.text || 'Text status'}</strong> : <img src={message.story.thumbnailUrl || message.story.mediaUrl} alt="Status preview" />)}</button>}
          {message.imageUrl && !message.deleted && <a className="message-image-link" href={message.imageUrl} target="_blank" rel="noreferrer"><img className="message-image" src={message.imageUrl} alt="Image shared in chat" loading="lazy"/></a>}
          {message.type === 'sticker' && !message.deleted && <img className="message-sticker-image" src={message.stickerUrl} alt={`${message.stickerId} sticker`} loading="lazy"/>}
          {message.type === 'voice' && !message.deleted && <VoiceMessage message={message}/>}
          {editing ? <div className="message-edit-form"><textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); saveEdit() } }} rows={2} autoFocus maxLength={5000}/><div><button type="button" onClick={saveEdit} disabled={busy || !draft.trim()}>Save</button><button type="button" onClick={() => { setDraft(message.text); setEditing(false) }} disabled={busy}>Cancel</button></div></div> : message.deleted ? <p>This message was deleted</p> : message.type === 'voice' || message.type === 'sticker' ? null : (message.text !== 'Photo' || !message.imageUrl) && <p>{message.text}</p>}
          <div className="message-meta"><span>{message.timestamp || 'now'}{message.editedAt && !message.deleted ? ' · edited' : ''}</span>{isOwn && <span className={`message-status ${message.status || 'sent'}`} aria-label={`Message ${message.status || 'sent'}`}>{statusIcon}</span>}</div>
        </div>
        {canTag ? groupedReactions.length > 0 && <div className="message-reaction-list">{groupedReactions.map(item => <span className={`message-reaction ${item.users.some(member => member.id === currentUserId) ? 'mine' : ''}`} key={item.emoji} aria-label={`${item.users.map(member => member.username).join(', ')} tagged this message ${item.emoji}`}>{item.emoji} {item.count}</span>)}</div> : reaction && <span className="message-reaction" aria-label={`Reaction ${reaction}`}>{reaction}</span>}
      </div>
      {toast && <span className="message-copy-toast" role="status">{toast}</span>}
    </div>
    {menu && <div className="message-action-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
      {canReply && !message.deleted && <button type="button" role="menuitem" data-action="reply" onClick={() => { onReply?.(message); setMenu(null) }}><Reply size={16}/>Reply</button>}
      {!message.deleted && <button type="button" role="menuitem" data-action="react" onClick={() => setShowReactions(current => !current)}>{canTag ? <Tag size={16} /> : <SmilePlus size={16} />}{canTag ? 'Tag message' : 'React'}</button>}
      {message.type === 'sticker' && !message.deleted && <><button type="button" role="menuitem" onClick={toggleStickerFavorite}><Heart size={16}/>{stickerFavorite ? 'Remove from Favorites' : 'Save to Favorites'}</button><button type="button" role="menuitem" onClick={() => { onSendSticker?.(message.stickerId); setMenu(null) }}><Reply size={16}/>Send sticker</button><button type="button" role="menuitem" onClick={() => setMenu(null)}>Cancel</button></>}
      {showReactions && <div className="message-reaction-picker" aria-label={canTag ? 'Choose a message tag' : 'Choose a reaction'}>{emojiOptions.map(emoji => <button type="button" key={emoji} disabled={busy} onClick={() => chooseReaction(emoji)} aria-label={`${canTag ? 'Tag' : 'React'} ${emoji}`}>{emoji}</button>)}</div>}
      {isOwn && canModify && !message.deleted && !['voice', 'sticker'].includes(message.type) && <button type="button" role="menuitem" data-action="edit" onClick={() => { setDraft(message.text); setEditing(true); setMenu(null) }}><Pencil size={16}/>Edit</button>}
      {isOwn && canModify && !message.deleted && <button type="button" role="menuitem" data-action="delete" onClick={() => { setConfirmDelete(true); setMenu(null) }}><Trash2 size={16}/>Delete</button>}
      {!message.deleted && <button type="button" role="menuitem" data-action="copy" onClick={copyMessage}><Copy size={16}/>Copy</button>}
    </div>}
    {confirmDelete && <div className="message-modal-layer" role="presentation" onClick={() => !busy && setConfirmDelete(false)}><section className="message-modal message-delete-dialog" role="dialog" aria-modal="true" aria-labelledby={`delete-message-${message.id}`} onClick={event => event.stopPropagation()}><div className="message-delete-icon"><Trash2 size={20}/></div><h2 id={`delete-message-${message.id}`}>Delete this message?</h2><p>This message will be removed for everyone in the conversation.</p><div className="message-modal-actions"><button type="button" className="ghost-button" onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</button><button type="button" className="primary-button danger" onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Delete message'}</button></div></section></div>}
  </>
}
