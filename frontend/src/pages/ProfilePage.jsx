import { ImagePlus, LogOut, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import UserAvatar from '../components/users/UserAvatar'

export default function ProfilePage() {
    const { user, token, logout, setSession } = useAuth()
    const fileInputRef = useRef(null)
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState('')

    const updateSessionUser = (nextUser) => setSession(token, nextUser)

    const handleAvatarChange = async (event) => {
        const file = event.target.files?.[0]
        if (!file) return

        setUploading(true)
        setUploadError('')
        try {
            const formData = new FormData()
            formData.append('avatar', file)
            const { data } = await api.put('/auth/profile/avatar', formData)
            updateSessionUser(data.user)
        } catch (error) {
            setUploadError(error.response?.data?.message || 'Unable to upload image')
        } finally {
            setUploading(false)
        }
    }

    const handleAvatarDelete = async () => {
        setUploading(true)
        setUploadError('')
        try {
            const { data } = await api.delete('/auth/profile/avatar')
            updateSessionUser(data.user)
        } catch (error) {
            setUploadError(error.response?.data?.message || 'Unable to remove image')
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="profile-page">
            <div className="profile-card">
                <div className="profile-header">
                    <UserAvatar user={user} className="profile-avatar" alt="Profile" />
                    <div>
                        <h2>{user?.username || 'Guest'}</h2>
                        <p>{user?.email || 'No email available'}</p>
                    </div>
                </div>

                <div className="profile-details">
                    <div>
                        <span>Account</span>
                        <strong>Personal workspace</strong>
                    </div>
                    <div>
                        <span>Status</span>
                        <strong>Online</strong>
                    </div>
                </div>

                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarChange} hidden />
                <div className="profile-picture-actions">
                    <button type="button" className="ghost-button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        <ImagePlus size={16} />
                        {uploading ? 'Uploading...' : 'Change profile picture'}
                    </button>
                    {user?.avatar && (
                        <button type="button" className="ghost-button" onClick={handleAvatarDelete} disabled={uploading}>
                            <Trash2 size={16} />
                            Remove profile picture
                        </button>
                    )}
                </div>
                {uploadError && <p className="inline-error">{uploadError}</p>}

                <div className="profile-actions">
                    <button type="button" className="primary-button danger" onClick={logout}>
                        <LogOut size={16} />
                        Logout
                    </button>
                </div>
            </div>
        </div>
    )
}
