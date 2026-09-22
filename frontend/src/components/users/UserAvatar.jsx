export default function UserAvatar({ user, className = '', alt = '' }) {
    const avatarUrl = typeof user?.avatar === 'string' && /^https?:\/\//i.test(user.avatar) ? user.avatar : ''
    const fallback = (user?.username || user?.name)?.trim()?.[0]?.toUpperCase() || 'U'

    return (
        <div className={`avatar ${avatarUrl ? 'has-image' : ''} ${className}`.trim()}>
            {avatarUrl ? <img className="user-avatar-image" src={avatarUrl} alt={alt} /> : fallback}
        </div>
    )
}
