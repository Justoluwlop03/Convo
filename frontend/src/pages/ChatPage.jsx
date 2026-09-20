import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Video, MoreHorizontal, PhoneCall, Plus } from 'lucide-react'
import { useChat } from '../context/ChatContext'
import ChatList from '../components/chat/ChatList'
import MessageBubble from '../components/chat/MessageBubble'
import MessageComposer from '../components/chat/MessageComposer'
import TypingIndicator from '../components/chat/TypingIndicator'
import UserSearch from '../components/users/UserSearch'
import UserAvatar from '../components/users/UserAvatar'

export default function ChatPage() {
    const { chats, activeChatId, selectedChat, activeMessages, typingUserId, selectChat, sendMessage, startTyping, stopTyping } = useChat()
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false)

    useEffect(() => {
        const handlePopState = () => setIsMobileChatOpen(false)
        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [])

    const conversationTitle = useMemo(() => selectedChat?.participant?.username || 'Select a conversation', [selectedChat])

    const handleSelectChat = (chatId) => {
        selectChat(chatId)
        if (!window.matchMedia('(max-width: 767px)').matches) return
        window.history.pushState({ ...window.history.state, convoMobileChat: true }, '')
        setIsMobileChatOpen(true)
    }

    const handleMobileBack = () => {
        if (window.history.state?.convoMobileChat) {
            window.history.back()
            return
        }
        setIsMobileChatOpen(false)
    }

    return (
        <div className={`chat-layout ${isMobileChatOpen ? 'mobile-chat-open' : 'mobile-list-open'}`}>
            <section className="sidebar-panel slim">
                <div className="sidebar-header">
                    <h3>Chats</h3>
                    <button type="button" className="ghost-button new-chat-button" aria-label="Start a new chat">
                        <Plus size={16} aria-hidden="true" />
                        <span>New chat</span>
                    </button>
                </div>
                <ChatList chats={chats} activeChatId={activeChatId} onSelect={handleSelectChat} />
            </section>

            <section className="mobile-chat-list" aria-label="Conversations">
                <div className="mobile-chat-list-header">
                    <div>
                        <span>Messages</span>
                        <h2>Chats</h2>
                    </div>
                    <span>{chats.length}</span>
                </div>
                <ChatList chats={chats} activeChatId={activeChatId} onSelect={handleSelectChat} />
            </section>

            <section className="chat-panel">
                {selectedChat ? (
                    <>
                        <header className="chat-header">
                            <button type="button" className="icon-button mobile-chat-back" aria-label="Back to chats" onClick={handleMobileBack}>
                                <ArrowLeft size={20} />
                            </button>
                            <div className="chat-user">
                                <UserAvatar user={selectedChat.participant} className="large" alt={`${conversationTitle}'s profile`} />
                                <div>
                                    <h2>{conversationTitle}</h2>
                                    <span className={selectedChat.participant.online ? 'status online' : 'status'}>
                                        {selectedChat.participant.online ? 'online' : selectedChat.participant.lastSeen || 'offline'}
                                    </span>
                                </div>
                            </div>

                            <div className="chat-actions">
                                <button type="button" className="icon-button"><PhoneCall size={16} /></button>
                                <button type="button" className="icon-button"><Video size={16} /></button>
                                <button type="button" className="icon-button"><MoreHorizontal size={16} /></button>
                            </div>
                        </header>

                        <div className="message-list">
                            {activeMessages.length === 0 ? (
                                <div className="empty-state wide">Start the conversation by saying hello.</div>
                            ) : (
                                activeMessages.map((message) => (
                                    <MessageBubble key={message.id} message={message} isOwn={message.isOwn} />
                                ))
                            )}
                            {typingUserId === selectedChat.participant.id && <TypingIndicator username={selectedChat.participant.username} />}
                        </div>

                        <MessageComposer onSend={sendMessage} onTypingStart={startTyping} onTypingStop={stopTyping} />
                    </>
                ) : (
                    <div className="empty-chat-shell">
                        <div className="empty-state wide">Choose a chat or search for a person to start messaging.</div>
                    </div>
                )}
            </section>

            <aside className="right-panel">
                <UserSearch />
            </aside>
        </div>
    )
}
