import { ArrowLeft, Check, ChevronLeft, ChevronRight, Ellipsis, Eye, Grid3X3, Heart, ImagePlus, LogOut, MessageCircle, MessageSquare, Pencil, Play, Plus, Send, Share2, Trash2, UserPlus, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { postService } from '../services/postService'
import { userService } from '../services/userService'
import api from '../services/api'
import UserAvatar from '../components/users/UserAvatar'
import '../styles/profile-social.css'

const mediaTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'])
const dateLabel = value => new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const videoPoster = url => url?.replace('/upload/', '/upload/so_0,c_fill,w_520,h_560,q_auto,f_jpg/')

export default function ProfilePage() {
    const { user, token, logout, setSession } = useAuth()
    const { userId } = useParams()
    const navigate = useNavigate()
    const { openChat } = useChat()
    const fileInputRef = useRef(null)
    const postFileRef = useRef(null)
    const previewsRef = useRef([])
    const detailRequestRef = useRef(0)
    const postsRequestRef = useRef(0)
    const isOwnProfile = !userId || userId === user?.id
    const targetId = isOwnProfile ? user?.id : userId
    const [profile, setProfile] = useState(user)
    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState({ username: '', displayName: '', bio: '', about: '' })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')
    const [tab, setTab] = useState('posts')
    const [posts, setPosts] = useState([])
    const [postsLoading, setPostsLoading] = useState(true)
    const [loadingMorePosts, setLoadingMorePosts] = useState(false)
    const [postsError, setPostsError] = useState('')
    const [page, setPage] = useState(1)
    const [hasMorePosts, setHasMorePosts] = useState(false)
    const [caption, setCaption] = useState('')
    const [postMedia, setPostMedia] = useState([])
    const [postPreviews, setPostPreviews] = useState([])
    const [creatingPost, setCreatingPost] = useState(false)
    const [postModal, setPostModal] = useState(null)
    const [postToDelete, setPostToDelete] = useState(null)
    const [deletingPost, setDeletingPost] = useState(false)
    const [galleryIndex, setGalleryIndex] = useState(0)
    const [detailLoading, setDetailLoading] = useState(false)
    const [likes, setLikes] = useState([])
    const [likesPage, setLikesPage] = useState(1)
    const [hasMoreLikes, setHasMoreLikes] = useState(false)
    const [likeBusy, setLikeBusy] = useState(false)
    const [comments, setComments] = useState([])
    const [commentsPage, setCommentsPage] = useState(1)
    const [hasMoreComments, setHasMoreComments] = useState(false)
    const [commentsLoading, setCommentsLoading] = useState(false)
    const [commentDraft, setCommentDraft] = useState('')
    const [commentBusy, setCommentBusy] = useState(false)
    const [moreOpen, setMoreOpen] = useState(false)
    const [notice, setNotice] = useState('')
    previewsRef.current = postPreviews

    useEffect(() => {
        if (!postToDelete) return undefined
        const handleKeyDown = event => {
            if (event.key === 'Escape' && !deletingPost) setPostToDelete(null)
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [deletingPost, postToDelete])

    useEffect(() => {
        return () => previewsRef.current.forEach(preview => URL.revokeObjectURL(preview))
    }, [])

    useEffect(() => {
        setError('')
        if (!targetId) return
        let current = true
        setLoading(true)
        userService.getUser(targetId)
            .then(nextProfile => {
                if (!current) return
                setProfile(nextProfile)
                if (isOwnProfile) setForm({ username: nextProfile.username || '', displayName: nextProfile.displayName || '', bio: nextProfile.bio || '', about: nextProfile.about || '' })
            })
            .catch(requestError => { if (current) setError(requestError.response?.data?.message || 'Unable to load this profile.') })
            .finally(() => { if (current) setLoading(false) })
        return () => { current = false }
    }, [isOwnProfile, targetId])

    const loadPosts = useCallback(async (nextPage = 1, replace = true) => {
        if (!targetId) return
        const requestId = ++postsRequestRef.current
        if (nextPage === 1) setPostsLoading(true)
        else setLoadingMorePosts(true)
        setPostsError('')
        try {
            const result = await postService.listUser(targetId, { page: nextPage, tab })
            if (requestId !== postsRequestRef.current) return
            setPosts(current => replace ? result.posts : [...current, ...result.posts.filter(item => !current.some(existing => existing.id === item.id))])
            setPage(nextPage)
            setHasMorePosts(result.hasMore)
        } catch (requestError) {
            if (requestId !== postsRequestRef.current) return
            setPostsError(requestError.response?.data?.message || 'Unable to load posts.')
        } finally {
            if (requestId === postsRequestRef.current) {
                setPostsLoading(false)
                setLoadingMorePosts(false)
            }
        }
    }, [tab, targetId])

    useEffect(() => {
        setPosts([])
        loadPosts(1, true)
    }, [loadPosts])

    const updateSessionUser = nextUser => {
        setProfile(current => ({ ...current, ...nextUser }))
        setSession(token, nextUser)
    }

    const saveProfile = async event => {
        event.preventDefault()
        setSaving(true)
        setError('')
        try {
            const { data } = await api.patch('/auth/profile', form)
            updateSessionUser(data.user)
            setForm(current => ({ ...current, displayName: data.user.displayName || '' }))
            setEditing(false)
        } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to save your profile.') }
        finally { setSaving(false) }
    }

    const handleAvatarChange = async event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return
        setUploading(true)
        setError('')
        try {
            const formData = new FormData()
            formData.append('avatar', file)
            const { data } = await api.put('/auth/profile/avatar', formData)
            updateSessionUser(data.user)
        } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to upload image.') }
        finally { setUploading(false) }
    }

    const handleAvatarDelete = async () => {
        setUploading(true)
        setError('')
        try { const { data } = await api.delete('/auth/profile/avatar'); updateSessionUser(data.user) }
        catch (requestError) { setError(requestError.response?.data?.message || 'Unable to remove image.') }
        finally { setUploading(false) }
    }

    const updateRelationship = async action => {
        setSaving(true)
        setError('')
        try {
            const updated = await action(profile.id)
            setProfile(current => ({ ...current, ...updated }))
            setProfile(await userService.getUser(targetId))
        }
        catch (requestError) { setError(requestError.response?.data?.message || 'Unable to update friend request.') }
        finally { setSaving(false) }
    }

    const choosePostMedia = event => {
        const files = Array.from(event.target.files || [])
        event.target.value = ''
        if (!files.length) return
        if (files.some(file => !mediaTypes.has(file.type))) { setPostsError('Choose JPEG, PNG, WebP, GIF, MP4, WebM, or MOV media.'); return }
        const videoFiles = files.filter(file => file.type.startsWith('video/'))
        if (videoFiles.length && (files.length !== 1 || postMedia.length > 0)) { setPostsError('Post one video at a time, or choose up to 6 images.'); return }
        if (postMedia.some(file => file.type.startsWith('video/'))) { setPostsError('Remove the selected video before adding images.'); return }
        if (files.some(file => file.size > 50 * 1024 * 1024)) { setPostsError(files.some(file => file.type.startsWith('video/')) ? 'Video is too large. Please choose a smaller video (50 MB max).' : 'Each image must be 50 MB or smaller.'); return }
        if (postMedia.length + files.length > 6) { setPostsError('Choose up to 6 images per post.'); return }
        setPostMedia(current => [...current, ...files])
        setPostPreviews(current => [...current, ...files.map(file => URL.createObjectURL(file))])
        setPostsError('')
    }

    const removePostImage = index => {
        URL.revokeObjectURL(postPreviews[index])
        setPostMedia(current => current.filter((_, itemIndex) => itemIndex !== index))
        setPostPreviews(current => current.filter((_, itemIndex) => itemIndex !== index))
    }

    const createPost = async event => {
        event.preventDefault()
        if (!postMedia.length && !caption.trim()) { setPostsError('Write a caption or choose up to 6 images.'); return }
        setCreatingPost(true)
        setPostsError('')
        try {
            const created = await postService.create({ media: postMedia, caption: caption.trim() })
            setPosts(current => tab === 'posts' ? [created, ...current.filter(item => item.id !== created.id)] : current)
            setProfile(current => ({ ...current, stats: { ...current?.stats, posts: (current?.stats?.posts || 0) + 1 } }))
            setCaption('')
            postPreviews.forEach(preview => URL.revokeObjectURL(preview))
            setPostPreviews([])
            setPostMedia([])
            setNotice('Post shared to your profile')
            window.setTimeout(() => setNotice(''), 2200)
        } catch (requestError) { setPostsError(requestError.response?.data?.message || 'Unable to create this post.') }
        finally { setCreatingPost(false) }
    }

    const openPost = useCallback(async post => {
        const requestId = ++detailRequestRef.current
        setPostModal(post)
        setGalleryIndex(0)
        setDetailLoading(true)
        setCommentsLoading(true)
        setLikes([])
        setComments([])
        setLikesPage(1)
        setCommentsPage(1)
        try {
            const [detail, commentsResult, likesResult] = await Promise.all([postService.get(post.id), postService.comments(post.id), postService.likes(post.id)])
            if (detailRequestRef.current !== requestId) return
            setPostModal(detail)
            setGalleryIndex(0)
            setComments(commentsResult.comments)
            setHasMoreComments(commentsResult.hasMore)
            setLikes(likesResult.users)
            setHasMoreLikes(likesResult.hasMore)
        } catch (requestError) {
            if (detailRequestRef.current === requestId) setNotice(requestError.response?.data?.message || 'Unable to load post details.')
        } finally {
            if (detailRequestRef.current === requestId) { setDetailLoading(false); setCommentsLoading(false) }
        }
    }, [])

    const closePost = useCallback(() => { detailRequestRef.current += 1; setPostModal(null); setCommentDraft('') }, [])
    const syncPost = updated => {
        setPostModal(current => current?.id === updated.id ? updated : current)
        setPosts(current => current.map(item => item.id === updated.id ? updated : item))
    }

    const toggleLike = async () => {
        if (!postModal || likeBusy) return
        setLikeBusy(true)
        const previous = postModal
        const optimistic = { ...previous, likedByMe: !previous.likedByMe, likesCount: Math.max(0, previous.likesCount + (previous.likedByMe ? -1 : 1)) }
        syncPost(optimistic)
        const profileLikeDelta = previous.user.id === user?.id ? (previous.likedByMe ? -1 : 1) : 0
        if (profileLikeDelta) setProfile(current => ({ ...current, stats: { ...current?.stats, likes: Math.max(0, (current?.stats?.likes || 0) + profileLikeDelta) } }))
        setLikes(current => previous.likedByMe ? current.filter(like => like.id !== user?.id) : current.some(like => like.id === user?.id) ? current : [{ id: user?.id, username: user?.username, displayName: user?.displayName || '', avatar: user?.avatar || '' }, ...current])
        try { syncPost(previous.likedByMe ? await postService.unlike(previous.id) : await postService.like(previous.id)) }
        catch (requestError) {
            syncPost(previous)
            setLikes(current => previous.likedByMe ? [...current, { id: user?.id, username: user?.username, displayName: user?.displayName || '', avatar: user?.avatar || '' }] : current.filter(like => like.id !== user?.id))
            if (profileLikeDelta) setProfile(current => ({ ...current, stats: { ...current?.stats, likes: Math.max(0, (current?.stats?.likes || 0) - profileLikeDelta) } }))
            setNotice(requestError.response?.data?.message || 'Unable to update like.')
        } finally { setLikeBusy(false) }
    }

    const submitComment = async event => {
        event.preventDefault()
        const text = commentDraft.trim()
        if (!text || !postModal) return
        setCommentBusy(true)
        try {
            const result = await postService.addComment(postModal.id, text)
            setComments(current => [...current, result.comment])
            setCommentDraft('')
            syncPost({ ...postModal, commentsCount: result.commentsCount })
        } catch (requestError) { setNotice(requestError.response?.data?.message || 'Unable to add your comment.') }
        finally { setCommentBusy(false) }
    }

    const loadMoreComments = async () => {
        if (!postModal || commentsLoading) return
        setCommentsLoading(true)
        try {
            const result = await postService.comments(postModal.id, commentsPage + 1)
            setComments(current => [...result.comments, ...current])
            setCommentsPage(result.page)
            setHasMoreComments(result.hasMore)
        } catch (requestError) { setNotice(requestError.response?.data?.message || 'Unable to load more comments.') }
        finally { setCommentsLoading(false) }
    }

    const loadMoreLikes = async () => {
        if (!postModal) return
        try {
            const result = await postService.likes(postModal.id, likesPage + 1)
            setLikes(current => [...current, ...result.users])
            setLikesPage(result.page)
            setHasMoreLikes(result.hasMore)
        } catch (requestError) { setNotice(requestError.response?.data?.message || 'Unable to load more likes.') }
    }

    const deleteComment = async comment => {
        try {
            await postService.removeComment(postModal.id, comment.id)
            setComments(current => current.filter(item => item.id !== comment.id))
            syncPost({ ...postModal, commentsCount: Math.max(0, postModal.commentsCount - 1) })
        } catch (requestError) { setNotice(requestError.response?.data?.message || 'Unable to delete this comment.') }
    }

    const deletePost = async post => {
        setPostToDelete(post)
    }

    const confirmDeletePost = async () => {
        if (!postToDelete || deletingPost) return
        const post = postToDelete
        setDeletingPost(true)
        try {
            await postService.remove(post.id)
            setPosts(current => current.filter(item => item.id !== post.id))
            setProfile(current => ({ ...current, stats: { ...current?.stats, posts: Math.max(0, (current?.stats?.posts || 0) - 1), likes: Math.max(0, (current?.stats?.likes || 0) - post.likesCount) } }))
            if (postModal?.id === post.id) closePost()
            setPostToDelete(null)
        } catch (requestError) { setNotice(requestError.response?.data?.message || 'Unable to delete this post.') }
        finally { setDeletingPost(false) }
    }

    const sharePost = async () => {
        const url = `${window.location.origin}/profile/${postModal.user.id}?post=${postModal.id}`
        try {
            if (navigator.share) await navigator.share({ title: `${postModal.user.displayName || postModal.user.username} on CONVO`, url })
            else { await navigator.clipboard.writeText(url); setNotice('Post link copied') }
        } catch (shareError) { if (shareError.name !== 'AbortError') setNotice('Unable to share this post.') }
    }

    const copyProfile = async () => {
        try { await navigator.clipboard.writeText(`${window.location.origin}/profile/${profile.id}`); setNotice('Profile link copied') }
        catch { setNotice('Unable to copy profile link.') }
        setMoreOpen(false)
    }

    useEffect(() => {
        const postId = new URLSearchParams(window.location.search).get('post')
        if (!postId || postsLoading) return
        openPost(posts.find(post => post.id === postId) || { id: postId })
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.hash}`)
    }, [openPost, posts, postsLoading])

    useEffect(() => {
        if (!editing && !postModal) return undefined
        const closeOnEscape = event => {
            if (event.key !== 'Escape') return
            if (postModal) closePost()
            else setEditing(false)
        }
        window.addEventListener('keydown', closeOnEscape)
        return () => window.removeEventListener('keydown', closeOnEscape)
    }, [closePost, editing, postModal])

    if (loading) return <div className="profile-page social-profile-page"><div className="profile-skeleton"><i/><i/><i/><div/></div></div>
    if (!profile) return <div className="profile-page social-profile-page"><div className="profile-card">{error || 'This profile could not be found.'}</div></div>

    return <div className="profile-page social-profile-page">
        <section className="social-profile-card">
            {!isOwnProfile && <button type="button" className="ghost-button profile-back" onClick={() => navigate(-1)}><ArrowLeft size={16}/>Back</button>}
            <div className="social-profile-heading">
                <UserAvatar user={profile} className="social-profile-avatar" alt={`${profile.username}'s profile`} showOnlineStatus/>
                <div className="social-profile-identity"><div className="social-profile-name"><h1>{profile.displayName || profile.username}</h1><span className={`profile-presence ${profile.online ? 'online' : ''}`}>{profile.online ? 'Online now' : 'On CONVO'}</span></div><p className="profile-handle">@{profile.username}</p><p className="profile-bio">{profile.bio || (isOwnProfile ? 'Add a short bio to introduce yourself.' : 'No bio yet.')}</p>{profile.about && <p className="profile-about-line">{profile.about}</p>}</div>
                <div className="social-profile-actions">
                    {isOwnProfile ? <button type="button" className="primary-button" onClick={() => setEditing(true)}><Pencil size={16}/>Edit profile</button> : <>
                        {profile.relationship === 'friends' && <button type="button" className="primary-button" onClick={async () => { try { await openChat(profile); navigate('/') } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to start a conversation.') } }}><MessageCircle size={16}/>Message</button>}
                        {profile.relationship === 'none' && <button type="button" className="primary-button" disabled={saving} onClick={() => updateRelationship(userService.sendFriendRequest)}><UserPlus size={16}/>Add friend</button>}
                        {profile.relationship === 'outgoing' && <button type="button" className="ghost-button" disabled>Request sent</button>}
                        {profile.relationship === 'incoming' && <><button type="button" className="primary-button" disabled={saving} onClick={() => updateRelationship(userService.acceptFriendRequest)}><Check size={16}/>Accept</button><button type="button" className="ghost-button" disabled={saving} onClick={() => updateRelationship(userService.declineFriendRequest)}>Decline</button></>}
                    </>}
                    <div className="profile-more-wrap"><button type="button" className="profile-more-button" aria-label="More profile options" onClick={() => setMoreOpen(value => !value)}><Ellipsis size={19}/></button>{moreOpen && <div className="profile-more-menu"><button type="button" onClick={copyProfile}><Share2 size={15}/>Copy profile link</button>{isOwnProfile && <button type="button" onClick={logout}><LogOut size={15}/>Log out</button>}</div>}</div>
                </div>
            </div>
            <div className="profile-statistics" aria-label="Profile statistics">
                <div><strong>{profile.stats?.posts ?? 0}</strong><span>Posts</span></div>
                <button type="button" className="profile-friend-stat" onClick={() => navigate(`/friends/${profile.id}`)} aria-label={`View ${profile.stats?.friends ?? 0} friends`}><strong>{profile.stats?.friends ?? 0}</strong><span>Friends</span></button>
                <div><strong>{profile.stats?.likes ?? 0}</strong><span>Likes</span></div>
            </div>
            {error && <p className="inline-error profile-error">{error}</p>}
        </section>

        <section className="profile-posts-section">
            <nav className="profile-tabs" aria-label="Profile posts">
                <button type="button" className={tab === 'posts' ? 'active' : ''} aria-selected={tab === 'posts'} onClick={() => setTab('posts')}><Grid3X3 size={16}/>Posts</button>
                {isOwnProfile && <button type="button" className={tab === 'liked' ? 'active' : ''} aria-selected={tab === 'liked'} onClick={() => setTab('liked')}><Heart size={16}/>Liked</button>}
            </nav>
            {isOwnProfile && tab === 'posts' && <form className="create-post-card" onSubmit={createPost}>
                <div className="create-post-heading"><UserAvatar user={profile} alt=""/><label htmlFor="profile-post-caption">Share something with your friends</label></div>
                <textarea id="profile-post-caption" value={caption} onChange={event => setCaption(event.target.value)} rows={2} maxLength={2200} placeholder="What’s on your mind?"/>
                {!!postPreviews.length && <div className="post-upload-preview-grid">{postPreviews.map((preview, index) => <div className="post-upload-preview" key={preview}>{postMedia[index]?.type.startsWith('video/') ? <video src={preview} controls playsInline preload="metadata"/> : <img src={preview} alt={`Post image ${index + 1} preview`}/>}<button type="button" aria-label={`Remove media ${index + 1}`} onClick={() => removePostImage(index)}><X size={16}/></button></div>)}</div>}
                <footer><input ref={postFileRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple onChange={choosePostMedia} hidden/><button type="button" className="ghost-button" onClick={() => postFileRef.current?.click()} disabled={postMedia.some(file => file.type.startsWith('video/')) || postMedia.length >= 6}><ImagePlus size={16}/>{postMedia.some(file => file.type.startsWith('video/')) ? 'Video selected' : postMedia.length ? `Add photos (${postMedia.length}/6)` : 'Add photos or video'}</button><button type="submit" className="primary-button" disabled={creatingPost || (!caption.trim() && !postMedia.length)}>{creatingPost ? 'Sharing…' : <><Plus size={16}/>Share post</>}</button></footer>
            </form>}
            {postsError && <p className="inline-error profile-error">{postsError}</p>}
            {postsLoading ? <div className="post-grid">{Array.from({ length: 6 }, (_, index) => <div className="post-skeleton" key={index}/>)}</div> : posts.length ? <div className="post-grid">{posts.map(post => <button type="button" className={`post-grid-card ${post.mediaType === 'text' ? 'text-post-card' : ''}`} key={post.id} onClick={() => openPost(post)} aria-label={`Open post by ${post.user.username}`}>
                {post.mediaType === 'image' && <><img src={post.mediaUrls?.[0] || post.mediaUrl} alt={post.caption || 'Post image'} loading="lazy"/>{(post.mediaUrls?.length || 0) > 1 && <span className="post-image-count">1/{post.mediaUrls.length}</span>}</>}
                {post.mediaType === 'video' && <><video src={post.mediaUrl} poster={videoPoster(post.mediaUrl)} muted playsInline preload="metadata"/><span className="post-video-mark"><Play size={16} fill="currentColor"/></span></>}
                {post.mediaType === 'text' && <span className="text-post-caption">{post.caption}</span>}
                {post.caption && post.mediaType !== 'text' && <span className="post-caption-scrim">{post.caption}</span>}
                <span className="post-view-count"><Eye size={13}/>{post.viewsCount || 0}</span>
                <span className="post-grid-engagement"><span><Heart size={17} fill="currentColor"/>{post.likesCount}</span><span><MessageSquare size={17} fill="currentColor"/>{post.commentsCount}</span></span>
            </button>)}</div> : <div className="profile-empty-posts"><div><Grid3X3 size={24}/><h2>{tab === 'liked' ? 'No liked posts yet' : isOwnProfile ? 'Your profile starts here' : 'No posts yet'}</h2><p>{tab === 'liked' ? 'Posts you like will appear here.' : isOwnProfile ? 'Share a photo, video, or thought with your friends.' : 'When this person shares a post, it will appear here.'}</p></div></div>}
            {hasMorePosts && !postsLoading && <button type="button" className="load-posts-button" onClick={() => loadPosts(page + 1, false)} disabled={loadingMorePosts}>{loadingMorePosts ? 'Loading…' : 'Load more posts'}</button>}
        </section>

        {editing && <div className="profile-modal-layer" onClick={() => !saving && setEditing(false)}><form className="profile-edit-modal" onSubmit={saveProfile} onClick={event => event.stopPropagation()}>
            <header><div><span className="profile-modal-eyebrow">YOUR ACCOUNT</span><h2>Edit profile</h2></div><button type="button" className="profile-more-button" aria-label="Close" onClick={() => setEditing(false)}><X size={18}/></button></header>
            <div className="profile-photo-editor"><UserAvatar user={profile} className="profile-photo-editor-avatar" alt=""/><div><strong>Profile photo</strong><span>Use a clear photo so friends recognize you.</span><div className="profile-photo-editor-actions"><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarChange} hidden/><button type="button" className="ghost-button" onClick={() => fileInputRef.current?.click()} disabled={uploading}><ImagePlus size={15}/>{uploading ? 'Uploading…' : 'Change photo'}</button>{profile.avatar && <button type="button" className="ghost-button" onClick={handleAvatarDelete} disabled={uploading}><Trash2 size={15}/>Remove photo</button>}</div></div></div>
            <label><span>Display name</span><input value={form.displayName} maxLength={50} placeholder={profile.username} onChange={event => setForm({ ...form, displayName: event.target.value })}/></label>
            <label><span>Username</span><input value={form.username} minLength={2} maxLength={30} onChange={event => setForm({ ...form, username: event.target.value })}/></label>
            <label><span>Bio <small>{form.bio.length}/160</small></span><input value={form.bio} maxLength={160} placeholder="A short intro" onChange={event => setForm({ ...form, bio: event.target.value })}/></label>
            <label><span>About <small>{form.about.length}/1000</small></span><textarea value={form.about} maxLength={1000} rows={4} placeholder="Tell people what you’re interested in" onChange={event => setForm({ ...form, about: event.target.value })}/></label>
            {error && <p className="inline-error">{error}</p>}<footer><button type="button" className="ghost-button" onClick={() => setEditing(false)} disabled={saving}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></footer>
        </form></div>}

        {postModal && <div className="post-detail-layer" role="presentation" onClick={closePost}><section className="post-detail-modal" role="dialog" aria-modal="true" aria-label="Post details" onClick={event => event.stopPropagation()}>
            <button type="button" className="post-detail-close" onClick={closePost} aria-label="Close post"><X size={20}/></button>
            <div className={`post-detail-media ${postModal.mediaType === 'text' ? 'text-post-detail' : ''} ${postModal.mediaType === 'image' ? 'photo-post-detail' : ''}`} style={postModal.mediaType === 'image' ? { '--post-media-background': `url("${postModal.mediaUrls?.[galleryIndex] || postModal.mediaUrl}")` } : undefined}>
                {detailLoading ? <div className="post-detail-loader"/> : postModal.mediaType === 'image' ? <><img src={postModal.mediaUrls?.[galleryIndex] || postModal.mediaUrl} alt={postModal.caption || `Post image ${galleryIndex + 1}`}/>{(postModal.mediaUrls?.length || 0) > 1 && <><button type="button" className="post-gallery-arrow previous" aria-label="Previous image" onClick={() => setGalleryIndex(index => (index - 1 + postModal.mediaUrls.length) % postModal.mediaUrls.length)}><ChevronLeft size={23}/></button><button type="button" className="post-gallery-arrow next" aria-label="Next image" onClick={() => setGalleryIndex(index => (index + 1) % postModal.mediaUrls.length)}><ChevronRight size={23}/></button><span className="post-gallery-counter">{galleryIndex + 1} / {postModal.mediaUrls.length}</span></>}</> : postModal.mediaType === 'video' ? <video src={postModal.mediaUrl} controls playsInline/> : <p>{postModal.caption}</p>}
            </div>
            <div className="post-detail-side">
                <header className="post-detail-author"><UserAvatar user={postModal.user} alt=""/><div><strong>{postModal.user.displayName || postModal.user.username}</strong><span>@{postModal.user.username} · {dateLabel(postModal.createdAt)}</span></div>{isOwnProfile && postModal.user.id === user?.id && <button type="button" className="post-delete-button" aria-label="Delete post" onClick={() => deletePost(postModal)}><Trash2 size={17}/></button>}</header>
                {postModal.mediaType !== 'text' && postModal.caption && <p className="post-detail-caption">{postModal.caption}</p>}
                <div className="post-detail-counts"><button type="button" onClick={toggleLike} disabled={likeBusy} className={postModal.likedByMe ? 'liked' : ''} aria-label={postModal.likedByMe ? 'Unlike post' : 'Like post'}><Heart size={20} fill={postModal.likedByMe ? 'currentColor' : 'none'}/></button><strong>{postModal.likesCount}</strong><span>likes</span><MessageSquare size={18}/><strong>{postModal.commentsCount}</strong><span>comments</span><Eye size={18}/><strong>{postModal.viewsCount || 0}</strong><span>views</span><button type="button" className="post-share-button" aria-label="Share post" onClick={sharePost}><Share2 size={18}/></button></div>
                <div className="post-detail-likes"><div className="post-detail-section-heading"><strong>Liked by</strong>{hasMoreLikes && <button type="button" onClick={loadMoreLikes}>See more</button>}</div>{likes.length ? <div className="post-likers">{likes.slice(0, 8).map(like => <UserAvatar key={like.id} user={like} alt={like.username}/>) }{likes.length > 8 && <span>+{likes.length - 8}</span>}</div> : <p className="post-detail-muted">Be the first to like this post.</p>}</div>
                <div className="post-comments-list">{comments.map(comment => <article className="post-comment" key={comment.id}><UserAvatar user={comment.user} alt=""/><div><p><strong>{comment.user.displayName || comment.user.username}</strong> {comment.text}</p><time>{dateLabel(comment.createdAt)}</time></div>{(comment.user.id === user?.id || (isOwnProfile && postModal.user.id === user?.id)) && <button type="button" aria-label="Delete comment" onClick={() => deleteComment(comment)}><Trash2 size={14}/></button>}</article>)}{commentsLoading && <p className="post-detail-muted">Loading comments…</p>}{hasMoreComments && !commentsLoading && <button type="button" className="load-comments-button" onClick={loadMoreComments}>Load earlier comments</button>}{!comments.length && !commentsLoading && <p className="post-detail-muted">No comments yet. Start the conversation.</p>}</div>
                <form className="post-comment-form" onSubmit={submitComment}><UserAvatar user={user} alt=""/><input value={commentDraft} onChange={event => setCommentDraft(event.target.value)} maxLength={1000} placeholder="Add a comment…"/><button type="submit" disabled={commentBusy || !commentDraft.trim()} aria-label="Post comment">{commentBusy ? '…' : <Send size={17}/>}</button></form>
            </div>
        </section></div>}
        {postToDelete && <div className="post-confirm-layer" onMouseDown={event => { if (event.target === event.currentTarget && !deletingPost) setPostToDelete(null) }}><section className="post-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="post-delete-title" aria-describedby="post-delete-description"><div className="post-confirm-icon"><Trash2 size={20}/></div><h2 id="post-delete-title">Delete this post?</h2><p id="post-delete-description">This post and its comments will be permanently deleted. This action can’t be undone.</p><footer><button type="button" className="ghost-button" onClick={() => setPostToDelete(null)} disabled={deletingPost} autoFocus>Cancel</button><button type="button" className="primary-button danger" onClick={confirmDeletePost} disabled={deletingPost}><Trash2 size={16}/>{deletingPost ? 'Deleting…' : 'Delete post'}</button></footer></section></div>}
        {notice && <div className="profile-toast" role="status">{notice}</div>}
    </div>
}
