import { ArrowLeft, Check, ImagePlus, LogOut, MessageCircle, Pencil, Save, Trash2, UserPlus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import api from '../services/api'
import { userService } from '../services/userService'
import UserAvatar from '../components/users/UserAvatar'

export default function ProfilePage() {
    const { user, token, logout, setSession } = useAuth()
    const { userId } = useParams()
    const navigate = useNavigate()
    const { openChat } = useChat()
    const fileInputRef = useRef(null)
    const isOwnProfile = !userId || userId === user?.id
    const [profile, setProfile] = useState(user)
    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState({ username: '', bio: '', about: '' })
    const [loading, setLoading] = useState(!isOwnProfile)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        setError('')
        if (isOwnProfile) {
            setProfile(user)
            setForm({ username: user?.username || '', bio: user?.bio || '', about: user?.about || '' })
            setLoading(false)
            return
        }
        setLoading(true)
        userService.getUser(userId)
            .then((nextProfile) => setProfile(nextProfile))
            .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load this profile.'))
            .finally(() => setLoading(false))
    }, [isOwnProfile, user, userId])

    const updateSessionUser = (nextUser) => {
        setProfile(nextUser)
        setSession(token, nextUser)
    }

    const saveProfile = async (event) => {
        event.preventDefault()
        setSaving(true)
        setError('')
        try {
            const { data } = await api.patch('/auth/profile', form)
            updateSessionUser(data.user)
            setEditing(false)
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Unable to save your profile.')
        } finally {
            setSaving(false)
        }
    }

    const handleAvatarChange = async (event) => {
        const file = event.target.files?.[0]
        if (!file) return
        setUploading(true)
        setError('')
        try {
            const formData = new FormData()
            formData.append('avatar', file)
            const { data } = await api.put('/auth/profile/avatar', formData)
            updateSessionUser(data.user)
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Unable to upload image.')
        } finally {
            setUploading(false)
        }
    }

    const handleAvatarDelete = async () => {
        setUploading(true)
        setError('')
        try {
            const { data } = await api.delete('/auth/profile/avatar')
            updateSessionUser(data.user)
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Unable to remove image.')
        } finally {
            setUploading(false)
        }
    }

    const startChat = async () => {
        try {
            await openChat(profile)
            navigate('/')
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Unable to start a conversation.')
        }
    }

    const updateRelationship = async (action) => {
        setSaving(true)
        setError('')
        try {
            const updated = await action(profile.id)
            setProfile(updated)
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Unable to update friend request.')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="profile-page"><div className="profile-card">Loading profile...</div></div>

    return (
        <div className="profile-page">
            <div className="profile-card social-profile-card">
                {!isOwnProfile && <button type="button" className="ghost-button profile-back" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</button>}
                <div className="profile-cover" />
                <div className="profile-header social-profile-header">
                    <UserAvatar user={profile} className="profile-avatar" alt={`${profile?.username || 'User'}'s profile`} showOnlineStatus />
                    <div>
                        <h2>{profile?.username || 'User'}</h2>
                        <p>{profile?.online ? 'Online now' : 'Offline'}</p>
                    </div>
                </div>

                {isOwnProfile && editing ? (
                    <form className="profile-edit-form" onSubmit={saveProfile}>
                        <label><span>Username</span><input value={form.username} minLength="2" maxLength="30" onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
                        <label><span>Bio <small>{form.bio.length}/160</small></span><input value={form.bio} maxLength="160" placeholder="A short intro" onChange={(event) => setForm({ ...form, bio: event.target.value })} /></label>
                        <label><span>About <small>{form.about.length}/1000</small></span><textarea value={form.about} maxLength="1000" rows="5" placeholder="Tell people a little about yourself" onChange={(event) => setForm({ ...form, about: event.target.value })} /></label>
                        <div className="profile-actions"><button type="button" className="ghost-button" onClick={() => setEditing(false)} disabled={saving}><X size={16} /> Cancel</button><button type="submit" className="primary-button" disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save profile'}</button></div>
                    </form>
                ) : (
                    <div className="profile-content">
                        <section><h3>Bio</h3><p>{profile?.bio || (isOwnProfile ? 'Add a short bio to introduce yourself.' : 'No bio yet.')}</p></section>
                        <section><h3>About</h3><p className="profile-about">{profile?.about || (isOwnProfile ? 'Share more about yourself, your interests, or what you are working on.' : 'No details shared yet.')}</p></section>
                    </div>
                )}

                {error && <p className="inline-error">{error}</p>}

                {isOwnProfile ? (
                    <>
                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarChange} hidden />
                        {!editing && <div className="profile-actions"><button type="button" className="primary-button" onClick={() => setEditing(true)}><Pencil size={16} /> Edit profile</button></div>}
                        <div className="profile-picture-actions">
                            <button type="button" className="ghost-button" onClick={() => fileInputRef.current?.click()} disabled={uploading}><ImagePlus size={16} />{uploading ? 'Uploading...' : 'Change photo'}</button>
                            {profile?.avatar && <button type="button" className="ghost-button" onClick={handleAvatarDelete} disabled={uploading}><Trash2 size={16} /> Remove photo</button>}
                        </div>
                        <div className="profile-actions"><button type="button" className="primary-button danger" onClick={logout}><LogOut size={16} /> Logout</button></div>
                    </>
                ) : <div className="profile-actions">
                    {profile?.relationship === 'friends' && <button type="button" className="primary-button" onClick={startChat}><MessageCircle size={16} /> Message</button>}
                    {profile?.relationship === 'none' && <button type="button" className="primary-button" disabled={saving} onClick={() => updateRelationship(userService.sendFriendRequest)}><UserPlus size={16} /> Add friend</button>}
                    {profile?.relationship === 'outgoing' && <button type="button" className="ghost-button" disabled>Friend request sent</button>}
                    {profile?.relationship === 'incoming' && <><button type="button" className="primary-button" disabled={saving} onClick={() => updateRelationship(userService.acceptFriendRequest)}><Check size={16} /> Accept request</button><button type="button" className="ghost-button" disabled={saving} onClick={() => updateRelationship(userService.declineFriendRequest)}>Decline</button></>}
                </div>}
            </div>
        </div>
    )
}
