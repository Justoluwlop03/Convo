import { SendHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export default function MessageComposer({ onSend, onTypingStart, onTypingStop, replyTo, onCancelReply, disabled = false, disabledMessage = '' }) {
    const [value, setValue] = useState('')
    const typingTimeoutRef = useRef(null)
    const isTypingRef = useRef(false)
    const stopTypingRef = useRef(null)

    const stopTyping = () => {
        if (!isTypingRef.current) return
        isTypingRef.current = false
        onTypingStop?.()
    }

    useEffect(() => {
        stopTypingRef.current = stopTyping
    })

    const handleChange = (event) => {
        setValue(event.target.value)
        if (!isTypingRef.current) {
            isTypingRef.current = true
            onTypingStart?.()
        }

        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(stopTyping, 1200)
    }

    useEffect(() => () => {
        clearTimeout(typingTimeoutRef.current)
        stopTypingRef.current?.()
    }, [])

    const handleSubmit = (event) => {
        event.preventDefault()
        const trimmed = value.trim()
        if (!trimmed || disabled) return
        onSend(trimmed, replyTo)
        clearTimeout(typingTimeoutRef.current)
        stopTyping()
        setValue('')
    }

    return (
        <form className="composer" onSubmit={handleSubmit}>
            {replyTo && <div className="composer-reply"><div><strong>Replying to {replyTo.sender?.username || 'message'}</strong><span>{replyTo.text}</span></div><button type="button" onClick={onCancelReply} aria-label="Cancel reply"><X size={15}/></button></div>}
            <textarea
                value={value}
                onChange={handleChange}
                placeholder={disabled ? disabledMessage || 'Messaging is unavailable.' : 'Write a message...'}
                rows={1}
                disabled={disabled}
            />
            <button type="submit" className="primary-button send-button" disabled={disabled || !value.trim()} aria-label="Send message">
                <SendHorizontal size={16} />
                <span>Send</span>
            </button>
        </form>
    )
}
