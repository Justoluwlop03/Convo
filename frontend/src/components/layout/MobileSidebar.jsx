import { Bell, Clapperboard, LogOut, MessageSquareText, MoonStar, Search, Settings, SunMedium, UserPlus, UserRound, Users, X } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import UserAvatar from '../users/UserAvatar'

export default function MobileSidebar({ isOpen, onClose, user, onLogout, isLightMode, onToggleTheme }) {
    useEffect(() => {
        if (!isOpen) return undefined

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose()
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    const handleLogout = () => {
        onClose()
        onLogout()
    }

    return (
        <div className={`mobile-drawer-layer ${isOpen ? 'is-open' : ''}`} aria-hidden={!isOpen}>
            <button type="button" className="mobile-drawer-backdrop" aria-label="Close menu" onClick={onClose} />
            <aside className="mobile-drawer" aria-label="Mobile navigation">
                <div className="mobile-drawer-header">
                    <div className="mobile-drawer-brand">
                        <div className="brand-mark">C</div>
                        <span>CONVO</span>
                    </div>
                    <button type="button" className="icon-button mobile-drawer-close" aria-label="Close menu" onClick={onClose}>
                        <X size={19} />
                    </button>
                </div>

                <div className="mobile-drawer-profile">
                    <UserAvatar user={user} className="large" alt="Profile" />
                    <div>
                        <strong>{user?.username || 'User'}</strong>
                        <span>Online</span>
                    </div>
                </div>

                <nav className="mobile-drawer-nav">
                    <NavLink to="/profile" className="mobile-drawer-link" onClick={onClose}><UserRound size={18} />Profile</NavLink>
                    <NavLink to="/" className="mobile-drawer-link" end onClick={onClose}><MessageSquareText size={18} />Messages</NavLink>
                    <NavLink to="/search" className="mobile-drawer-link" onClick={onClose}><Search size={18} />Find people</NavLink>
                    <NavLink to="/reels" className="mobile-drawer-link" onClick={onClose}><Clapperboard size={18}/>Posts</NavLink>
                    <NavLink to={`/friends/${user?.id}`} className="mobile-drawer-link" onClick={onClose}><Users size={18}/>Friends</NavLink>
                    <NavLink to="/add-back" className="mobile-drawer-link" onClick={onClose}><UserPlus size={18}/>People to add back</NavLink>
                    <NavLink to="/settings" className="mobile-drawer-link" onClick={onClose}><Settings size={18} />Settings</NavLink>
                    <button type="button" className="mobile-drawer-link" onClick={onToggleTheme}>
                        {isLightMode ? <MoonStar size={18} /> : <SunMedium size={18} />}
                        {isLightMode ? 'Dark mode' : 'Light mode'}
                    </button>
                    <button type="button" className="mobile-drawer-link" onClick={onClose}><Bell size={18} />Notifications</button>
                </nav>

                <button type="button" className="mobile-drawer-link mobile-logout" onClick={handleLogout}>
                    <LogOut size={18} />Logout
                </button>
            </aside>
        </div>
    )
}
