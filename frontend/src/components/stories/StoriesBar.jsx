import { CirclePlus } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useStories } from '../../context/StoryContext'
import UserAvatar from '../users/UserAvatar'
import StoryComposer from './StoryComposer'

export default function StoriesBar() {
  const { user } = useAuth(); const { stories, loading, openStories } = useStories(); const [creating, setCreating] = useState(false)
  return <section className="stories-bar" aria-label="Stories"><div className="stories-heading"><h3>Stories</h3><span>24h</span></div><div className="story-strip"><button type="button" className="story-card add-story-card" onClick={() => setCreating(true)}><span className="story-ring add-story-ring"><CirclePlus size={25}/></span><strong>Add story</strong></button>{stories.map(group => <button type="button" className="story-card" key={group.user.id} onClick={() => openStories(group)}><span className={`story-ring ${group.stories.every(story => story.viewed) ? 'viewed' : ''}`}><UserAvatar user={group.user} alt="" /></span><strong>{group.user.id === user?.id ? 'Your story' : group.user.username}</strong><small>{group.stories[0]?.timeAgo}</small></button>)}{!loading && !stories.length && <span className="stories-empty">Share a moment with friends.</span>}</div>{creating && <StoryComposer onClose={() => setCreating(false)} />}</section>
}
