import { ArrowLeft, MessageCircle, UserRoundPlus, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import UserAvatar from '../components/users/UserAvatar'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { userService } from '../services/userService'
import '../styles/friends.css'

export default function FriendsPage() {
  const { userId } = useParams()
  const { user } = useAuth()
  const { openChat } = useChat()
  const navigate = useNavigate()
  const isOwnList = userId === user?.id
  const [owner, setOwner] = useState(isOwnList ? user : null)
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    setLoading(true)
    setError('')
    Promise.all([isOwnList ? Promise.resolve(user) : userService.getUser(userId), userService.getFriends(userId)])
      .then(([profile, entries]) => {
        if (!current) return
        setOwner(profile)
        setFriends(entries)
      })
      .catch(requestError => { if (current) setError(requestError.response?.data?.message || 'Unable to load this friend list.') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [isOwnList, user, userId])

  const messageFriend = async friend => {
    try { await openChat(friend); navigate('/') }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to open this conversation.') }
  }

  return <div className="search-page-shell friends-page-shell"><section className="search-page-card friends-page-card">
    <header className="friends-page-heading">
      <button type="button" className="ghost-button friends-back-button" onClick={() => navigate(-1)}><ArrowLeft size={16}/>Back</button>
      <div className="friends-title"><Users size={21}/><div><h1>{owner ? `${owner.displayName || owner.username}’s friends` : 'Friends'}</h1><p>{loading ? 'Loading friend list…' : `${friends.length} ${friends.length === 1 ? 'friend' : 'friends'}`}</p></div></div>
      <Link className="ghost-button add-back-link" to="/add-back"><UserRoundPlus size={16}/>People to add back</Link>
    </header>
    {error && <p className="inline-error">{error}</p>}
    {loading ? <div className="neutral-state">Loading friends…</div> : !error && !friends.length ? <div className="friends-empty"><Users size={24}/><h2>No friends yet</h2><p>{isOwnList ? 'Friends you add will appear here.' : 'This person has not added any friends yet.'}</p></div> : <div className="search-results friends-results">{friends.map(friend => <article className="search-result friend-list-item" key={friend.id}>
      <button type="button" className="search-result-profile" onClick={() => navigate(`/profile/${friend.id}`)}><UserAvatar user={friend} alt="" showOnlineStatus/><span className="friend-list-identity"><strong>{friend.displayName || friend.username}</strong><small>@{friend.username}{friend.online ? ' · online' : ''}</small></span></button>
      {friend.relationship === 'friends' && <button type="button" className="ghost-button compact-action" onClick={() => messageFriend(friend)}><MessageCircle size={15}/>Message</button>}
      {friend.relationship === 'none' && <Link className="ghost-button compact-action" to={`/profile/${friend.id}`}>View profile</Link>}
      {friend.relationship === 'incoming' && <Link className="primary-button compact-action" to="/add-back"><UserRoundPlus size={15}/>Add back</Link>}
      {friend.relationship === 'outgoing' && <span className="friend-request-pending">Request sent</span>}
    </article>)}</div>}
  </section></div>
}
