import ChatListItem from './ChatListItem'

export default function ChatList({ chats, activeChatId, onSelect }) {
    return (
        <div className="chat-list">
            {chats.length === 0 ? (
                <div className="empty-state">No conversations yet. Start by searching for someone.</div>
            ) : (
                chats.map((chat) => (
                    <ChatListItem key={chat.id} chat={chat} active={chat.id === activeChatId} onSelect={onSelect} />
                ))
            )}
        </div>
    )
}
