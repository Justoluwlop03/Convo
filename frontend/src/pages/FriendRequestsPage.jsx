import { Check, UserX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UserAvatar from '../components/users/UserAvatar'
import { userService } from '../services/userService'

export default function FriendRequestsPage() {
    const [requests, setRequests] = useState([])
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        userService.getFriendRequests().then(setRequests).catch((err) => setError(err.response?.data?.message || 'Unable to load friend requests.')).finally(() => setLoading(false))
    }, [])

    const respond = async (request, action) => {
        try {
            await action(request.id)
            setRequests((current) => current.filter(item => item.id !== request.id))
        } catch (err) {
            setError(err.response?.data?.message || 'Unable to update friend request.')
        }
    }

    return <div className="search-page-shell"><div className="search-page-card search-panel">
        <div className="recommended-header"><h2>People to add back</h2><p>These people sent you a request. Add them back to become friends.</p></div>
        {loading && <div className="neutral-state">Loading requests...</div>}
        {error && <div className="inline-error">{error}</div>}
        {!loading && !error && !requests.length && <div className="neutral-state">No pending friend requests.</div>}
        <div className="search-results">{requests.map((request) => <div className="search-result" key={request.id}>
            <button type="button" className="search-result-profile" onClick={() => navigate(`/profile/${request.id}`)}><UserAvatar user={request} alt={`${request.username}'s profile`} /><div><strong>{request.username}</strong><small>{request.online ? 'online now' : 'offline'}</small></div></button>
            <button type="button" className="primary-button compact-action" onClick={() => respond(request, userService.acceptFriendRequest)}><Check size={15} /> Add back</button>
            <button type="button" className="ghost-button compact-action" onClick={() => respond(request, userService.declineFriendRequest)}><UserX size={15} /> Decline</button>
        </div>)}</div>
    </div></div>
}
