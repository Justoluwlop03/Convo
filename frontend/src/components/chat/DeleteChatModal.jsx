import { useState } from 'react'
import { Trash2, X } from 'lucide-react'

export default function DeleteChatModal({ name, onClose, onDelete }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const remove = async () => {
    setBusy(true)
    setError('')
    try {
      await onDelete()
      onClose()
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to delete this conversation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="group-modal-layer" role="presentation" onClick={() => !busy && onClose()}>
      <section className="group-modal" role="dialog" aria-modal="true" aria-labelledby="delete-chat-title" onClick={event => event.stopPropagation()}>
        <div className="group-modal-heading">
          <div><h2 id="delete-chat-title">Delete conversation?</h2><p>This cannot be undone.</p></div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose} disabled={busy}><X size={18} /></button>
        </div>
        <p>All messages between you and <strong>{name}</strong> will be permanently deleted for both people.</p>
        {error && <p className="inline-error">{error}</p>}
        <div className="group-modal-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="primary-button danger" onClick={remove} disabled={busy}><Trash2 size={16} />{busy ? 'Deleting…' : 'Delete chat'}</button>
        </div>
      </section>
    </div>
  )
}
