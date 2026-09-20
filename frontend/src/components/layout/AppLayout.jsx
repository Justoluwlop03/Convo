import { Bell, LogOut, Menu, MessageSquareText, MoonStar, Search, Settings, SunMedium, UserPlus, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import MobileSidebar from './MobileSidebar'
import UserAvatar from '../users/UserAvatar'
import InstallConvoButton from '../pwa/InstallConvoButton'

export default function AppLayout() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isLightMode, setIsLightMode] = useState(() => {
        const savedTheme = localStorage.getItem('convo-theme')
        if (savedTheme) return savedTheme === 'light'
        return window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false
    })

    useEffect(() => {
        const theme = isLightMode ? 'light' : 'dark'
        localStorage.setItem('convo-theme', theme)
        document.documentElement.style.colorScheme = theme
    }, [isLightMode])

    const toggleTheme = () => setIsLightMode((value) => !value)

    return (
            <div className={`app-shell ${isLightMode ? 'theme-light' : 'theme-dark'}`}>
            <aside className="sidebar-panel">
                <div className="brand-row">
                    <div className="brand-mark">C</div>
                    <div>
                        <h2>Convo</h2>
                    </div>
                </div>

                <nav className="nav-menu" aria-label="Main navigation">
                    <NavLink to="/" className="nav-link" end>
                        <MessageSquareText size={18} />
                        Messages
                    </NavLink>
                    <NavLink to="/search" className="nav-link">
                        <Search size={18} />
                        Find people
                    </NavLink>
                    <NavLink to="/requests" className="nav-link">
                        <UserPlus size={18} />
                        Friend requests
                    </NavLink>
                    <NavLink to="/profile" className="nav-link">
                        <UserRound size={18} />
                        Profile
                    </NavLink>
                    <NavLink to="/settings" className="nav-link">
                        <Settings size={18} />
                        Settings
                    </NavLink>
                </nav>

                <div className="profile-panel">
                    <UserAvatar user={user} className="profile-avatar sidebar-profile-avatar" alt="Profile" />
                    <div>
                        <strong>{user?.username || 'User'}</strong>
                        <small>Online</small>
                    </div>
                    <button type="button" onClick={logout} className="icon-button" aria-label="Logout">
                        <LogOut size={16} />
                    </button>
                </div>
            </aside>

            <main className="main-panel">
                <header className="topbar">
                    <div>
                        <span className="eyebrow">Inbox</span>
                        <h1>Conversations</h1>
                    </div>
                    <div className="topbar-actions">
                        <InstallConvoButton />
                        <button
                            type="button"
                            className="icon-button muted"
                            aria-label={isLightMode ? 'Switch to dark mode' : 'Switch to light mode'}
                            aria-pressed={isLightMode}
                            onClick={toggleTheme}
                        >
                            {isLightMode ? <MoonStar size={16} /> : <SunMedium size={16} />}
                        </button>
                        <button type="button" className="icon-button muted" aria-label="Notifications">
                            <Bell size={16} />
                        </button>
                    </div>
                </header>

                <header className="mobile-app-header">
                    <div className="mobile-app-brand" aria-label="Convo">
                        <span className="mobile-brand-mark">C</span>
                        <span>CONVO</span>
                    </div>
                    <div className="mobile-app-actions">
                        <InstallConvoButton compact />
                        <button type="button" className="icon-button" aria-label="Find people" onClick={() => navigate('/search')}>
                            <Search size={19} />
                        </button>
                        <button type="button" className="icon-button" aria-label={isLightMode ? 'Switch to dark mode' : 'Switch to light mode'} onClick={toggleTheme}>
                            {isLightMode ? <MoonStar size={19} /> : <SunMedium size={19} />}
                        </button>
                        <button type="button" className="icon-button" aria-label="Notifications">
                            <Bell size={19} />
                        </button>
                        <button type="button" className="icon-button mobile-menu-button" aria-label="Open menu" aria-expanded={isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(true)}>
                            <Menu size={20} />
                        </button>
                    </div>
                </header>

                <Outlet />
            </main>

            <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
                <NavLink to="/" className="mobile-tab" end>
                    <MessageSquareText size={18} />
                    <span>Chats</span>
                </NavLink>
                <NavLink to="/search" className="mobile-tab">
                    <Search size={18} />
                    <span>Search</span>
                </NavLink>
                <NavLink to="/profile" className="mobile-tab">
                    <UserRound size={18} />
                    <span>Profile</span>
                </NavLink>
            </nav>

            <MobileSidebar
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
                user={user}
                onLogout={logout}
                isLightMode={isLightMode}
                onToggleTheme={toggleTheme}
            />
        </div>
    )
}
