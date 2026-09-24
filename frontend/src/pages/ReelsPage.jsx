import { ChevronLeft, ChevronRight, Eye, Heart, MessageCircle, Play, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import UserAvatar from '../components/users/UserAvatar'
import { useAuth } from '../context/AuthContext'
import { postService } from '../services/postService'
import '../styles/reels.css'

function Reel({ post: initialPost, onView }) {
  const [post, setPost] = useState(initialPost)
  const [imageIndex, setImageIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const cardRef = useRef(null)
  const videoRef = useRef(null)
  const viewedRef = useRef(false)

  useEffect(() => {
    const card = cardRef.current
    if (!card || !('IntersectionObserver' in window)) return undefined
    const observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) { videoRef.current?.pause(); return }
      videoRef.current?.play().catch(() => {})
      if (viewedRef.current) return
      viewedRef.current = true
      onView(post.id, setPost)
    }, { threshold: 0.65 })
    observer.observe(card)
    return () => observer.disconnect()
  }, [onView, post.id])

  const toggleLike = async () => {
    if (busy) return
    setBusy(true)
    try { setPost(await (post.likedByMe ? postService.unlike(post.id) : postService.like(post.id))) }
    finally { setBusy(false) }
  }

  return <article className={`reel-card ${post.mediaType === 'image' ? 'reel-image-card' : ''}`} ref={cardRef} style={post.mediaType === 'image' ? { '--reel-image-background': `url("${post.mediaUrls?.[imageIndex] || post.mediaUrl}")` } : undefined}>
    {post.mediaType === 'video' ? <video ref={videoRef} className="reel-media" src={post.mediaUrl} playsInline loop muted preload="none" controls /> : post.mediaType === 'image' ? <><img className="reel-media" src={post.mediaUrls?.[imageIndex] || post.mediaUrl} alt={post.caption || `Post by ${post.user.username}`} loading="lazy"/>{(post.mediaUrls?.length || 0) > 1 && <div className="reel-gallery"><button type="button" aria-label="Previous image" onClick={() => setImageIndex(index => (index - 1 + post.mediaUrls.length) % post.mediaUrls.length)}><ChevronLeft/></button><span>{imageIndex + 1}/{post.mediaUrls.length}</span><button type="button" aria-label="Next image" onClick={() => setImageIndex(index => (index + 1) % post.mediaUrls.length)}><ChevronRight/></button></div>}</> : <div className="reel-text-post"><span>CONVO</span><p>{post.caption}</p></div>}
    <div className="reel-shade"/>
    <div className="reel-caption">
      <Link to={`/profile/${post.user.id}`} className="reel-author"><UserAvatar user={post.user} alt=""/><span><strong>{post.user.displayName || post.user.username}</strong><small>@{post.user.username}</small></span></Link>
      {post.mediaType !== 'text' && post.caption && <p>{post.caption}</p>}
    </div>
    <div className="reel-actions">
      <button type="button" onClick={toggleLike} disabled={busy} aria-label={post.likedByMe ? 'Unlike post' : 'Like post'} className={post.likedByMe ? 'liked' : ''}><Heart fill={post.likedByMe ? 'currentColor' : 'none'}/><span>{post.likesCount || 0}</span></button>
      <Link to={`/profile/${post.user.id}`} aria-label="View profile and comments"><MessageCircle/><span>{post.commentsCount || 0}</span></Link>
      <div aria-label={`${post.viewsCount || 0} views`}><Eye/><span>{post.viewsCount || 0}</span></div>
    </div>
    {post.mediaType === 'video' && <Play className="reel-play-mark" size={16} fill="currentColor"/>}
  </article>
}

export default function ReelsPage() {
  const { user } = useAuth()
  const userId = user?.id
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)

  const load = useCallback(async (nextPage = 1, append = false) => {
    if (nextPage === 1) setLoading(true)
    else setLoadingMore(true)
    setError('')
    try {
      const result = await postService.feed({ page: nextPage })
      setPosts(current => append ? [...current, ...result.posts.filter(post => !current.some(existing => existing.id === post.id))] : result.posts)
      setPage(nextPage)
      setHasMore(result.hasMore)
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load posts.') }
    finally { setLoading(false); setLoadingMore(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const recordView = useCallback(async (postId, updatePost) => {
    try {
      const viewed = await postService.view(postId)
      updatePost(viewed)
      if (viewed.user?.id === userId) setPosts(current => current.map(post => post.id === postId ? viewed : post))
    } catch { /* View tracking can retry the next time the feed is opened. */ }
  }, [userId])

  return <main className="reels-page">
    <header className="reels-heading"><div><span>FROM YOUR PEOPLE</span><h1>Posts</h1></div><p>Scroll to explore</p></header>
    {error && <div className="reels-message"><p>{error}</p><button type="button" onClick={() => load()}><RefreshCw size={16}/> Try again</button></div>}
    {loading ? <div className="reels-loading">Loading posts…</div> : posts.length ? <>
      <section className="reels-scroller" aria-label="Posts from you and your friends">{posts.map(post => <Reel key={post.id} post={post} onView={recordView}/>)}</section>
      {hasMore && <button type="button" className="reels-load-more" onClick={() => load(page + 1, true)} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more posts'}</button>}
    </> : <div className="reels-empty"><Play size={26}/><h2>No posts in your feed yet</h2><p>Posts from you and your friends will show up here.</p></div>}
  </main>
}
