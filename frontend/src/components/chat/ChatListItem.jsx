import { CheckCheck, Users } from 'lucide-react'
import UserAvatar from '../users/UserAvatar'

export default function ChatListItem({ chat, active, onSelect }) {
    return (
        <button type="button" className={`chat-item ${active ? 'active' : ''} ${chat.unreadCount > 0 ? 'has-unread' : ''}`} onClick={() => onSelect(chat.id)}>
            <UserAvatar user={chat.type === 'group' ? chat : chat.participant} alt="" showOnlineStatus={chat.type !== 'group' && chat.participant.online} />
            <div className="chat-item-body">
                <div className="chat-item-meta">
                    <strong>{chat.type === 'group' ? chat.name : chat.participant.username}</strong>
                    <span>{chat.updatedAt}</span>
                </div>
                <div className="chat-item-row">
                    <p>{chat.lastMessage}</p>
                    {chat.unreadCount > 0 ? <span className="badge">{chat.unreadCount}</span> : <CheckCheck size={14} />}
                </div>
            </div>
            {chat.type === 'group' && <Users size={14} className="online-dot" />}
        </button>
    )
}
