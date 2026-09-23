import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { useChat } from './ChatContext'
import { storyService } from '../services/storyService'

const StoryContext = createContext(null)

export function StoryProvider({ children }) {
  const { user } = useAuth()
  const { socket } = useChat()
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewer, setViewer] = useState(null)
  const [feedError, setFeedError] = useState('')

  const refreshStories = useCallback(async () => {
    if (!user?.id) return []
    try { const next = await storyService.list(); setStories(next); setFeedError(''); return next } catch (error) { setFeedError(error.response?.data?.message || 'Unable to load stories.'); throw error } finally { setLoading(false) }
  }, [user?.id])

  useEffect(() => { setLoading(true); refreshStories().catch(() => setStories([])) }, [refreshStories])
  useEffect(() => {
    if (!socket) return undefined
    const refresh = () => refreshStories().catch(() => {})
    socket.on('story_created', refresh); socket.on('story_deleted', refresh); socket.on('story_interaction', refresh)
    return () => { socket.off('story_created', refresh); socket.off('story_deleted', refresh); socket.off('story_interaction', refresh) }
  }, [refreshStories, socket])

  const publishStory = useCallback(async payload => { const story = await storyService.create(payload); await refreshStories(); return story }, [refreshStories])
  const openStories = useCallback((group, index = 0) => {
    const groupIndex = stories.findIndex(item => item.user.id === group.user.id)
    if (groupIndex >= 0) setViewer({ groups: stories, groupIndex, index: Math.max(0, Math.min(index, stories[groupIndex].stories.length - 1)) })
  }, [stories])
  const openStoryById = useCallback(async storyId => {
    const knownGroup = stories.find(group => group.stories.some(item => item.id === storyId))
    if (knownGroup) { openStories(knownGroup, knownGroup.stories.findIndex(item => item.id === storyId)); return }
    try {
      const story = await storyService.get(storyId)
      setViewer({ groups: [{ user: story.user, stories: [{ id: story.id }] }], groupIndex: 0, index: 0 })
    } catch { /* expired story links stay unavailable */ }
  }, [openStories, stories])
  const closeViewer = useCallback(() => setViewer(null), [])
  const moveViewer = useCallback(direction => setViewer(current => {
    if (!current) return current
    const group = current.groups[current.groupIndex]
    const next = current.index + direction
    if (next >= 0 && next < group.stories.length) return { ...current, index: next }
    const nextGroupIndex = current.groupIndex + (direction > 0 ? 1 : -1)
    if (nextGroupIndex < 0 || nextGroupIndex >= current.groups.length) return null
    return { ...current, groupIndex: nextGroupIndex, index: direction > 0 ? 0 : current.groups[nextGroupIndex].stories.length - 1 }
  }), [])
  const value = useMemo(() => ({ stories, loading, feedError, viewer, publishStory, refreshStories, openStories, openStoryById, closeViewer, moveViewer }), [closeViewer, feedError, loading, moveViewer, openStories, openStoryById, publishStory, refreshStories, stories, viewer])
  return <StoryContext.Provider value={value}>{children}</StoryContext.Provider>
}

export function useStories() {
  const context = useContext(StoryContext)
  if (!context) throw new Error('useStories must be used within a StoryProvider')
  return context
}
