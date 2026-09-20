import { CheckCheck, CircleDot } from 'lucide-react'
import UserAvatar from '../users/UserAvatar'

export default function ChatListItem({ chat, active, onSelect }) {
    return (
        <button type="button" className={`chat-item ${active ? 'active' : ''}`} onClick={() => onSelect(chat.id)}>
            <UserAvatar user={chat.participant} alt="" />
            <div className="chat-item-body">
                <div className="chat-item-meta">
                    <strong>{chat.participant.username}</strong>
                    <span>{chat.updatedAt}</span>
                </div>
                <div className="chat-item-row">
                    <p>{chat.lastMessage}</p>
                    {chat.unreadCount > 0 ? <span className="badge">{chat.unreadCount}</span> : <CheckCheck size={14} />}
                </div>
            </div>
            {chat.participant.online && <CircleDot size={10} className="online-dot" />}
        </button>
    )
}
