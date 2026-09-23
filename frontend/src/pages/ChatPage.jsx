import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Video, MoreHorizontal, PhoneCall, Plus, Trash2 } from 'lucide-react'
import { useChat } from '../context/ChatContext'
import ChatList from '../components/chat/ChatList'
import MessageBubble from '../components/chat/MessageBubble'
import MessageComposer from '../components/chat/MessageComposer'
import TypingIndicator from '../components/chat/TypingIndicator'
import UserSearch from '../components/users/UserSearch'
import UserAvatar from '../components/users/UserAvatar'
import CreateGroupModal from '../components/chat/CreateGroupModal'
import GroupInfoModal from '../components/chat/GroupInfoModal'
import DeleteChatModal from '../components/chat/DeleteChatModal'
import { useAuth } from '../context/AuthContext'
import { useCall } from '../context/CallContext'
import StoriesBar from '../components/stories/StoriesBar'

export default function ChatPage() {
    const { chats, activeChatId, selectedChat, activeMessages, typingUserId, selectChat, setConversationVisible, sendMessage, editMessage, deleteMessage, deleteChat, startTyping, stopTyping, createGroup, refreshChats } = useChat()
    const { user } = useAuth()
    const { call, startCall } = useCall()
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false)
    const [replyingTo, setReplyingTo] = useState(null)
    const [creatingGroup, setCreatingGroup] = useState(false)
    const [showGroupInfo, setShowGroupInfo] = useState(false)
    const [showDeleteChat, setShowDeleteChat] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        const handlePopState = () => setIsMobileChatOpen(false)
        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [])

    useEffect(() => {
        const visible = Boolean(selectedChat) && (!window.matchMedia('(max-width: 767px)').matches || isMobileChatOpen)
        setConversationVisible(selectedChat?.id, visible)
        return () => setConversationVisible(selectedChat?.id, false)
    }, [isMobileChatOpen, selectedChat?.id, setConversationVisible])

    const conversationTitle = useMemo(() => selectedChat?.type === 'group' ? selectedChat.name : selectedChat?.participant?.username || 'Select a conversation', [selectedChat])
    const groupIsLockedForMember = selectedChat?.type === 'group' && selectedChat.locked && !selectedChat.admins?.some(admin => admin.id === user?.id)

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
                    <button type="button" className="ghost-button new-chat-button" aria-label="Create a group" onClick={() => setCreatingGroup(true)}>
                        <Plus size={16} aria-hidden="true" />
                        <span>New group</span>
                    </button>
                </div>
                <StoriesBar compact />
                <ChatList chats={chats} activeChatId={activeChatId} onSelect={handleSelectChat} />
            </section>

            <section className="mobile-chat-list" aria-label="Conversations">
                <div className="mobile-chat-list-header">
                    <div>
                        <span>Messages</span>
                        <h2>Chats</h2>
                    </div>
                    <div className="mobile-chat-list-actions">
                        <button type="button" className="ghost-button new-chat-button" aria-label="Create a group" onClick={() => setCreatingGroup(true)}>
                            <Plus size={16} aria-hidden="true" />
                            <span>New group</span>
                        </button>
                        <span>{chats.length}</span>
                    </div>
                </div>
                <StoriesBar />
                <ChatList chats={chats} activeChatId={activeChatId} onSelect={handleSelectChat} />
            </section>

            <section className="chat-panel">
                {selectedChat ? (
                    <>
                        <header className="chat-header">
                            <button type="button" className="icon-button mobile-chat-back" aria-label="Back to chats" onClick={handleMobileBack}>
                                <ArrowLeft size={20} />
                            </button>
                            <button type="button" className="chat-user profile-link-button" onClick={() => selectedChat.type === 'group' ? setShowGroupInfo(true) : navigate(`/profile/${selectedChat.participant.id}`)}>
                                <UserAvatar user={selectedChat.type === 'group' ? selectedChat : selectedChat.participant} className="large" alt={`${conversationTitle}'s profile`} showOnlineStatus={selectedChat.type !== 'group' && selectedChat.participant.online} />
                                <div>
                                    <h2>{conversationTitle}</h2>
                                    <span className={selectedChat.type === 'group' ? 'status' : selectedChat.participant.online ? 'status online' : 'status'}>
                                        {selectedChat.type === 'group' ? `${selectedChat.memberCount} members` : selectedChat.participant.online ? 'online' : selectedChat.participant.lastSeen || 'offline'}
                                    </span>
                                </div>
                            </button>

                            <div className="chat-actions">
                                {selectedChat.type !== 'group' && <button type="button" className="icon-button" aria-label={`Call ${conversationTitle}`} disabled={call.status !== 'idle'} onClick={() => startCall(selectedChat)}><PhoneCall size={16} /></button>}
                                <button type="button" className="icon-button"><Video size={16} /></button>
                                <button type="button" className="icon-button"><MoreHorizontal size={16} /></button>
                                {selectedChat.type !== 'group' && <button type="button" className="icon-button" aria-label="Delete conversation" onClick={() => setShowDeleteChat(true)}><Trash2 size={16} /></button>}
                            </div>
                        </header>

                        <div className="message-list">
                            {activeMessages.length === 0 ? (
                                <div className="empty-state wide">Start the conversation by saying hello.</div>
                            ) : (
                                activeMessages.map((message) => (
                                    <MessageBubble key={message.id} message={message} isOwn={message.isOwn} canModify={selectedChat.type !== 'group'} canReply={selectedChat.type !== 'group'} onReply={setReplyingTo} onEdit={editMessage} onDelete={deleteMessage} />
                                ))
                            )}
                            {typingUserId && <TypingIndicator username={selectedChat.type === 'group' ? selectedChat.members?.find(member => member.id === typingUserId)?.username || 'Someone' : typingUserId === selectedChat.participant.id ? selectedChat.participant.username : ''} />}
                        </div>

                        <MessageComposer onSend={async (text, replyTo) => { await sendMessage(text, replyTo); setReplyingTo(null) }} onTypingStart={startTyping} onTypingStop={stopTyping} replyTo={replyingTo} onCancelReply={() => setReplyingTo(null)} disabled={groupIsLockedForMember} disabledMessage="This group is locked. Only admins can send messages." />
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
            {creatingGroup && <CreateGroupModal onClose={() => setCreatingGroup(false)} onCreate={createGroup} />}
            {showGroupInfo && selectedChat?.type === 'group' && <GroupInfoModal group={selectedChat} onClose={() => setShowGroupInfo(false)} onLeft={() => selectChat(chats.find(chat => chat.id !== selectedChat.id)?.id || null)} onChanged={refreshChats} />}
            {showDeleteChat && selectedChat?.type !== 'group' && <DeleteChatModal name={selectedChat.participant?.username || 'this person'} onClose={() => setShowDeleteChat(false)} onDelete={() => deleteChat(selectedChat.id)} />}
        </div>
    )
}
