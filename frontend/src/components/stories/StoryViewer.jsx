import { Eye, Flame, Heart, Laugh, Send, ThumbsUp, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useChat } from '../../context/ChatContext'
import { useStories } from '../../context/StoryContext'
import { storyService } from '../../services/storyService'
import UserAvatar from '../users/UserAvatar'

const STORY_DURATION = 6000
const reactions = [
  { emoji: '❤️', Icon: Heart, label: 'Love' }, { emoji: '😂', Icon: Laugh, label: 'Laugh' },
  { emoji: '😮', Icon: null, label: 'Wow' }, { emoji: '😢', Icon: null, label: 'Sad' },
  { emoji: '🔥', Icon: Flame, label: 'Fire' }, { emoji: '👍', Icon: ThumbsUp, label: 'Like' },
]

function elapsed(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours} hr ago` : `${Math.floor(hours / 24)} days ago`
}

export default function StoryViewer() {
  const { refreshChats, socket } = useChat()
  const { viewer, closeViewer, moveViewer, refreshStories } = useStories()
  const [story, setStory] = useState(null)
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const [notice, setNotice] = useState('')
  const [viewers, setViewers] = useState([])
  const [viewersHasMore, setViewersHasMore] = useState(false)
  const [viewersLoading, setViewersLoading] = useState(false)
  const [showViewers, setShowViewers] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [paused, setPaused] = useState(false)
  const [videoProgress, setVideoProgress] = useState(0)
  const pointerStart = useRef(null)
  const currentGroup = viewer?.groups[viewer.groupIndex]
  const selected = currentGroup?.stories[viewer?.index]
  const isOwner = story?.isOwner === true

  useEffect(() => {
    if (!selected) return undefined
    let alive = true
    setStory(null); setError(''); setComment(''); setNotice(''); setViewers([]); setShowViewers(false); setConfirmingDelete(false); setPaused(false); setVideoProgress(0)
    storyService.get(selected.id).then(async next => {
      if (!alive) return
      setStory(next)
      if (!next.isOwner) {
        storyService.markViewed(next.id).then(() => refreshStories().catch(() => {})).catch(() => {})
      } else {
        storyService.viewers(next.id).then(data => { if (alive) { setViewers(data.viewers); setViewersHasMore(data.hasMore) } }).catch(() => {})
      }
    }).catch(requestError => { if (alive) setError(requestError.response?.data?.message || 'This status is no longer available.') })
    return () => { alive = false }
  }, [refreshStories, selected?.id])

  useEffect(() => {
    if (!socket || !selected?.id) return undefined
    const handleDeleted = event => { if (event.storyId === selected.id) closeViewer() }
    socket.on('story_deleted', handleDeleted)
    return () => socket.off('story_deleted', handleDeleted)
  }, [closeViewer, selected?.id, socket])

  useEffect(() => {
    if (!story || paused || showViewers || confirmingDelete || story.mediaType === 'video') return undefined
    const timer = window.setTimeout(() => moveViewer(1), STORY_DURATION)
    return () => window.clearTimeout(timer)
  }, [confirmingDelete, isOwner, moveViewer, paused, showViewers, story, viewer?.index, viewer?.groupIndex])

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape') closeViewer()
      if (event.key === 'ArrowRight') moveViewer(1)
      if (event.key === 'ArrowLeft') moveViewer(-1)
    }
    if (!viewer) return undefined
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeViewer, moveViewer, viewer])

  const react = useCallback(async emoji => {
    if (!story) return
    try {
      const updated = await storyService.react(story.id, emoji)
      setStory(current => current ? { ...current, reactions: updated } : current)
      setNotice('Reaction sent')
      window.setTimeout(() => setNotice(''), 1600)
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to send your reaction.') }
  }, [story])

  const sendComment = async event => {
    event.preventDefault()
    if (!comment.trim() || !story) return
    try {
      const response = await storyService.reply(story.id, comment.trim())
      setComment(''); setNotice('Reply sent to messages')
      await refreshChats().catch(() => {})
      window.setTimeout(() => setNotice(''), 2200)
      return response
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to send your reply.') }
  }

  const remove = async () => {
    if (!story) return
    setDeleting(true); setError('')
    try { await storyService.remove(story.id); await refreshStories(); setConfirmingDelete(false); closeViewer() }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to delete this status.'); setDeleting(false) }
  }

  const openViewerList = async () => {
    if (!story) return
    setShowViewers(true); setViewersLoading(true)
    try { const data = await storyService.viewers(story.id); setViewers(data.viewers); setViewersHasMore(data.hasMore) }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load viewers.') }
    finally { setViewersLoading(false) }
  }
  const loadMoreViewers = async () => {
    if (!story || viewersLoading || !viewersHasMore) return
    setViewersLoading(true)
    try { const data = await storyService.viewers(story.id, Math.floor(viewers.length / 30) + 1); setViewers(current => [...current, ...data.viewers]); setViewersHasMore(data.hasMore) }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load more viewers.') }
    finally { setViewersLoading(false) }
  }

  const handlePointerDown = event => {
    if (event.target.closest('button, input, a, form')) return
    pointerStart.current = { x: event.clientX, y: event.clientY }
    setPaused(true)
  }
  const handlePointerUp = event => {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) moveViewer(dx < 0 ? 1 : -1)
    else if (dy > 80) closeViewer()
    setPaused(false)
  }

  if (!viewer) return null
  const groupStories = currentGroup?.stories || []

  return <div className="status-viewer-layer" role="dialog" aria-modal="true" aria-label="Status viewer" onClick={event => { if (event.target === event.currentTarget) closeViewer() }}>
    <section className={`status-viewer ${story?.mediaType === 'text' ? 'text-status-viewer' : ''}`} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerCancel={() => { pointerStart.current = null; setPaused(false) }}>
      <div className="status-progress-track" aria-label={`Status ${viewer.index + 1} of ${groupStories.length}`}>
        {groupStories.map((item, index) => <span className={`status-progress ${index < viewer.index ? 'complete' : index === viewer.index ? 'current' : ''} ${paused ? 'paused' : ''}`} key={item.id} style={{ '--status-duration': `${STORY_DURATION}ms`, '--video-progress': `${videoProgress}%` }}><i/></span>)}
      </div>
      <header className="status-viewer-header">
        {story && <Link className="status-profile-link" to={`/profile/${story.user.id}`} aria-label={`View ${story.user.username}'s profile`}><UserAvatar user={story.user} alt=""/><span><strong>{story.user.username}{isOwner ? ' · You' : ''}</strong><small>{story.timeAgo}</small></span></Link>}
        <div className="status-viewer-actions">{isOwner && <button type="button" className="status-header-button" onClick={openViewerList} aria-label={`View ${story?.viewCount || 0} viewers`}><Eye size={18}/><span>{story?.viewCount || 0}</span></button>}{isOwner && <button type="button" className="status-header-button delete" onClick={() => setConfirmingDelete(true)} aria-label="Delete status"><Trash2 size={18}/></button>}<button type="button" className="status-header-button" onClick={closeViewer} aria-label="Close status"><X size={21}/></button></div>
      </header>

      {story ? <>
        <div className={`status-media ${story.mediaType === 'text' ? 'text-status-media' : ''}`}>
          {story.mediaType === 'video' ? <video src={story.mediaUrl} autoPlay playsInline preload="metadata" onTimeUpdate={event => { const duration = event.currentTarget.duration; if (duration) setVideoProgress(event.currentTarget.currentTime / duration * 100) }} onEnded={() => moveViewer(1)} onPause={() => setPaused(true)} onPlay={() => setPaused(false)}/> : story.mediaType === 'image' ? <img src={story.mediaUrl} alt={story.caption || `${story.user.username}'s status`} draggable="false"/> : <div className="status-text-card"><span className="status-text-mark">“</span><p>{story.text}</p></div>}
        </div>
        {story.caption && <p className="status-caption">{story.caption}</p>}

        {!isOwner && <div className="status-interaction-area">
          <div className="status-quick-reactions" aria-label="React to this status">{reactions.map(({ emoji, Icon, label }) => <button type="button" key={emoji} aria-label={label} onClick={() => react(emoji)}>{Icon ? <Icon size={20} fill={emoji === '❤️' ? 'currentColor' : 'none'}/> : <span>{emoji}</span>}</button>)}</div>
          {story.canReply && <form className="status-reply-form" onSubmit={sendComment}><input value={comment} onChange={event => setComment(event.target.value)} placeholder={`Reply to ${story.user.username}…`} maxLength={5000} aria-label={`Reply to ${story.user.username}`}/><button type="submit" aria-label="Send reply" disabled={!comment.trim()}><Send size={18}/></button></form>}
        </div>}
      </> : <div className="status-loading-state">{error || 'Loading status…'}</div>}

      {error && <p className="status-viewer-error" role="alert">{error}</p>}{notice && <span className="status-viewer-notice" role="status">{notice}</span>}
      <button type="button" className="status-tap-zone previous" onClick={() => moveViewer(-1)} aria-label="Previous status"/><button type="button" className="status-tap-zone next" onClick={() => moveViewer(1)} aria-label="Next status"/>

      {showViewers && <div className="status-sheet-backdrop" onClick={() => setShowViewers(false)}><section className="status-viewer-sheet" onClick={event => event.stopPropagation()}><div className="status-sheet-handle"/><header><div><h2>Viewers</h2><p>{story?.viewCount || viewers.length} {story?.viewCount === 1 ? 'view' : 'views'}</p></div><button type="button" className="status-icon-button" onClick={() => setShowViewers(false)} aria-label="Close viewers"><X size={19}/></button></header><div className="status-viewer-list">{viewers.length ? viewers.map((view, index) => <Link to={`/profile/${view.user.id}`} className="status-viewer-person" key={`${view.user.id}-${index}`}><UserAvatar user={view.user} alt=""/><span><strong>{view.user.username}</strong><small>Viewed {elapsed(view.viewedAt)}</small></span>{view.reaction && <b>{view.reaction}</b>}</Link>) : <p className="status-empty-viewers">{viewersLoading ? 'Loading viewers…' : 'No viewers yet. They’ll appear here after they see your status.'}</p>}{viewersHasMore && <button type="button" className="status-load-more" onClick={loadMoreViewers} disabled={viewersLoading}>{viewersLoading ? 'Loading…' : 'Load more viewers'}</button>}</div></section></div>}
      {confirmingDelete && <div className="status-confirm-backdrop" onClick={() => !deleting && setConfirmingDelete(false)}><section className="status-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="status-delete-title" onClick={event => event.stopPropagation()}><span className="status-delete-mark"><Trash2 size={20}/></span><h2 id="status-delete-title">Delete this status?</h2><p>This status will no longer be visible to anyone. Replies in your chat will stay.</p>{error && <p className="status-form-error">{error}</p>}<div><button type="button" className="status-cancel-button" onClick={() => setConfirmingDelete(false)} disabled={deleting}>Cancel</button><button type="button" className="status-delete-button" onClick={remove} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete status'}</button></div></section></div>}
    </section>
  </div>
}
