import { SendHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export default function MessageComposer({ onSend, onTypingStart, onTypingStop }) {
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
        if (!trimmed) return
        onSend(trimmed)
        clearTimeout(typingTimeoutRef.current)
        stopTyping()
        setValue('')
    }

    return (
        <form className="composer" onSubmit={handleSubmit}>
            <textarea
                value={value}
                onChange={handleChange}
                placeholder="Write a message..."
                rows={1}
            />
            <button type="submit" className="primary-button send-button" disabled={!value.trim()} aria-label="Send message">
                <SendHorizontal size={16} />
                <span>Send</span>
            </button>
        </form>
    )
}
