import { AlertCircle, Check, CheckCheck, Clock3, Pencil, Reply, Save, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import UserAvatar from '../users/UserAvatar'

export default function MessageBubble({ message, isOwn, onReply, onEdit, onDelete }) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(message.text)
    const [busy, setBusy] = useState(false)
    const statusIcon = message.status === 'pending' || message.status === 'sending'
        ? <Clock3 size={14} strokeWidth={2.5} />
        : message.status === 'failed'
            ? <AlertCircle size={14} strokeWidth={2.5} />
            : message.status === 'sent'
                ? <Check size={15} strokeWidth={2.5} />
                : <CheckCheck size={15} strokeWidth={2.5} />

    const saveEdit = async () => {
        const text = draft.trim()
        if (!text || text === message.text) { setEditing(false); return }
        setBusy(true)
        try {
            await onEdit(message.id, text)
            setEditing(false)
        } finally {
            setBusy(false)
        }
    }

    const remove = async () => {
        if (!window.confirm('Delete this message?')) return
        setBusy(true)
        try { await onDelete(message.id) } finally { setBusy(false) }
    }

    return (
        <div className={`message-row ${isOwn ? 'own' : ''}`}>
            {!isOwn && <UserAvatar user={message.sender} className="tiny" alt={`${message.sender?.username || 'User'}'s profile`} />}
            <div className={`message-bubble-wrap ${isOwn ? 'own' : ''}`}>
                <div className={`message-bubble ${isOwn ? 'own' : ''} ${message.deleted ? 'deleted' : ''}`}>
                    {message.replyTo && (
                        <div className="reply-preview">
                            <strong>{message.replyTo.sender?.username || 'Message'}</strong>
                            <span>{message.replyTo.text}</span>
                        </div>
                    )}
                    {editing ? (
                        <div className="message-edit-form">
                            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} autoFocus />
                            <div><button type="button" onClick={saveEdit} disabled={busy || !draft.trim()} aria-label="Save edit"><Save size={14} /></button><button type="button" onClick={() => { setDraft(message.text); setEditing(false) }} aria-label="Cancel edit"><X size={14} /></button></div>
                        </div>
                    ) : <p>{message.text}</p>}
                    <div className="message-meta">
                        <span>{message.timestamp || 'now'}{message.editedAt && !message.deleted ? ' · edited' : ''}</span>
                        {isOwn && <span className={`message-status ${message.status || 'sent'}`} aria-label={`Message ${message.status || 'sent'}`}>{statusIcon}</span>}
                    </div>
                </div>
                {!editing && (
                    <div className="message-actions" aria-label="Message actions">
                        <button type="button" onClick={() => onReply(message)} aria-label="Reply"><Reply size={14} /></button>
                        {isOwn && !message.deleted && <button type="button" onClick={() => setEditing(true)} aria-label="Edit message"><Pencil size={14} /></button>}
                        {isOwn && !message.deleted && <button type="button" onClick={remove} disabled={busy} aria-label="Delete message"><Trash2 size={14} /></button>}
                    </div>
                )}
            </div>
        </div>
    )
}
