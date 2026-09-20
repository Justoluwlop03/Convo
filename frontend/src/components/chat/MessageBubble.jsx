import { Check, CheckCheck } from 'lucide-react'
import UserAvatar from '../users/UserAvatar'

export default function MessageBubble({ message, isOwn }) {
    const statusIcon = message.status === 'sent'
        ? <Check size={15} strokeWidth={2.5} />
        : <CheckCheck size={15} strokeWidth={2.5} />

    return (
        <div className={`message-row ${isOwn ? 'own' : ''}`}>
            {!isOwn && <UserAvatar user={message.sender} className="tiny" alt={`${message.sender?.username || 'User'}'s profile`} />}
            <div className={`message-bubble ${isOwn ? 'own' : ''}`}>
                <p>{message.text}</p>
                <div className="message-meta">
                    <span>{message.timestamp || 'now'}</span>
                    {isOwn && <span className={`message-status ${message.status || 'sent'}`} aria-label={`Message ${message.status || 'sent'}`}>{statusIcon}</span>}
                </div>
            </div>
        </div>
    )
}
