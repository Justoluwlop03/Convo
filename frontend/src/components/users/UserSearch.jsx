import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChat } from '../../context/ChatContext'
import { userService } from '../../services/userService'
import UserAvatar from './UserAvatar'

const hasDisplayName = (user) => Boolean(user?.id && typeof user.username === 'string' && user.username.trim())

export default function UserSearch() {
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [recommendedUsers, setRecommendedUsers] = useState([])
    const [recommendationsLoading, setRecommendationsLoading] = useState(true)
    const [recommendationsError, setRecommendationsError] = useState('')
    const latestRequestRef = useRef(0)
    const navigate = useNavigate()
    const { searchUsers, searchResults, setSearchResults, openChat } = useChat()

    useEffect(() => {
        let isCurrent = true

        userService.getRecommendedUsers()
            .then((users) => {
                if (isCurrent) setRecommendedUsers(users.filter(hasDisplayName))
            })
            .catch((err) => {
                if (isCurrent) setRecommendationsError(err.response?.data?.message || 'Unable to load recommended people.')
            })
            .finally(() => {
                if (isCurrent) setRecommendationsLoading(false)
            })

        return () => {
            isCurrent = false
        }
    }, [])

    useEffect(() => {
        const value = query.trim()
        const requestId = ++latestRequestRef.current

        if (!value) {
            setLoading(false)
            setError('')
            setSearchResults([])
            return undefined
        }

        const timeout = setTimeout(async () => {
            setLoading(true)
            setError('')

            try {
                const users = await searchUsers(value)
                if (requestId === latestRequestRef.current) setSearchResults(users.filter(hasDisplayName))
            } catch (err) {
                if (requestId === latestRequestRef.current) {
                    setError(err.response?.data?.message || err.message || 'Unable to search users right now.')
                }
            } finally {
                if (requestId === latestRequestRef.current) setLoading(false)
            }
        }, 300)

        return () => clearTimeout(timeout)
    }, [query, searchUsers, setSearchResults])

    const hasQuery = Boolean(query.trim())
    const visibleUsers = (hasQuery ? searchResults : recommendedUsers).filter(hasDisplayName)

    const handleOpenChat = async (user) => {
        try {
            await openChat(user)
            navigate('/')
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Unable to start a chat with this user.')
        }
    }

    return (
        <div className="search-panel">
            <div className="search-field">
                <Search size={16} />
                <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by username"
                    aria-label="Search users"
                    autoFocus
                />
            </div>

            {hasQuery && loading && <div className="neutral-state">Searching...</div>}
            {error && <div className="inline-error">{error}</div>}

            {hasQuery && !loading && !error && searchResults.length === 0 && (
                <div className="neutral-state">No users match that username.</div>
            )}

            {!hasQuery && (
                <div className="recommended-header">
                    <h2>Recommended people</h2>
                    <p>People you can start chatting with.</p>
                </div>
            )}

            {!hasQuery && recommendationsLoading && <div className="neutral-state">Loading people...</div>}
            {!hasQuery && recommendationsError && <div className="inline-error">{recommendationsError}</div>}
            {!hasQuery && !recommendationsLoading && !recommendationsError && recommendedUsers.length === 0 && (
                <div className="neutral-state">No people are available yet.</div>
            )}

            <div className="search-results">
                {visibleUsers.map((user) => (
                    <button type="button" key={user.id} className="search-result" onClick={() => handleOpenChat(user)}>
                        <UserAvatar user={user} alt={`${user.username}'s profile`} />
                        <div>
                            <strong>{user.username}</strong>
                            <small>{user.online ? 'online now' : 'offline'}</small>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    )
}
