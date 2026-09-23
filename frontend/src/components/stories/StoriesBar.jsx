import { Eye, Plus } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useStories } from '../../context/StoryContext'
import UserAvatar from '../users/UserAvatar'
import StoryComposer from './StoryComposer'

export default function StoriesBar({ compact = false }) {
  const { user } = useAuth()
  const { stories, loading, openStories } = useStories()
  const [creating, setCreating] = useState(false)
  const own = stories.find(group => group.user.id === user?.id)

  return <section className={`stories-bar ${compact ? 'compact' : ''}`} aria-label="Status updates">
    <div className="stories-heading"><div><h3>Stories</h3><span>Moments from your friends</span></div><button type="button" onClick={() => setCreating(true)} aria-label="Create a status"><Plus size={16}/><span>Create</span></button></div>
    <div className="story-strip">
      <button type="button" className="story-card add-story-card" onClick={() => own ? openStories(own) : setCreating(true)} aria-label={own ? 'Open your status' : 'Create your first status'}>
        <span className={`story-ring add-story-ring ${own ? own.hasUnviewed ? 'unviewed' : 'viewed' : ''}`}><UserAvatar user={user} alt=""/><i className="story-add-badge" aria-hidden="true"><Plus size={13}/></i></span>
        <strong>{own ? 'Your status' : 'Add status'}</strong><small>{own ? `${own.stories.length} update${own.stories.length === 1 ? '' : 's'}` : 'Share a moment'}</small>
        {own && <span className="story-views"><Eye size={11}/>{own.stories.reduce((total, story) => total + (story.viewCount || 0), 0)}</span>}
      </button>
      {stories.filter(group => group.user.id !== user?.id).map(group => <button type="button" className="story-card" key={group.user.id} onClick={() => openStories(group)} aria-label={`View ${group.user.username}'s status`}>
        <span className={`story-ring ${group.hasUnviewed ? 'unviewed' : 'viewed'}`}><UserAvatar user={group.user} alt=""/></span>
        <strong>{group.user.username}</strong><small>{group.stories[group.stories.length - 1]?.timeAgo}</small>
      </button>)}
      {!loading && !stories.length && <button type="button" className="stories-empty" onClick={() => setCreating(true)}>Share a photo, video, or text update.</button>}
      {loading && !stories.length && <span className="stories-loading">Loading stories…</span>}
    </div>
    {creating && <StoryComposer onClose={() => setCreating(false)}/>}
  </section>
}
