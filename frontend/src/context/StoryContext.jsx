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

  const refreshStories = useCallback(async () => {
    if (!user?.id) return []
    try { const next = await storyService.list(); setStories(next); return next } finally { setLoading(false) }
  }, [user?.id])

  useEffect(() => { setLoading(true); refreshStories().catch(() => setStories([])) }, [refreshStories])
  useEffect(() => {
    if (!socket) return undefined
    const refresh = () => refreshStories().catch(() => {})
    socket.on('story_created', refresh); socket.on('story_deleted', refresh)
    return () => { socket.off('story_created', refresh); socket.off('story_deleted', refresh) }
  }, [refreshStories, socket])

  const publishStory = useCallback(async payload => { const story = await storyService.create(payload); await refreshStories(); return story }, [refreshStories])
  const openStories = useCallback((group, index = 0) => {
    const ordered = stories.flatMap(item => item.stories)
    const selected = group.stories[index]
    setViewer({ stories: ordered, index: Math.max(0, ordered.findIndex(item => item.id === selected?.id)) })
  }, [stories])
  const closeViewer = useCallback(() => setViewer(null), [])
  const moveViewer = useCallback(direction => setViewer(current => {
    if (!current) return current
    const next = current.index + direction
    return next < 0 || next >= current.stories.length ? null : { ...current, index: next }
  }), [])
  const value = useMemo(() => ({ stories, loading, viewer, publishStory, refreshStories, openStories, closeViewer, moveViewer }), [closeViewer, loading, moveViewer, openStories, publishStory, refreshStories, stories, viewer])
  return <StoryContext.Provider value={value}>{children}</StoryContext.Provider>
}

export function useStories() {
  const context = useContext(StoryContext)
  if (!context) throw new Error('useStories must be used within a StoryProvider')
  return context
}
