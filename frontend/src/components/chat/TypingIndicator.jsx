export default function TypingIndicator({ username }) {
    return (
        <div className="typing-indicator">
            <span>{username} is typing</span>
            <div className="dots">
                <span />
                <span />
                <span />
            </div>
        </div>
    )
}
