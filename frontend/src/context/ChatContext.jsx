import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { chatService } from '../services/chatService'
import { userService } from '../services/userService'
import { deleteMessages as deleteCachedMessages, getQueuedMessages, loadConversations, loadMessages, queueMessage, removeQueuedMessage, saveConversations, saveMessages } from '../services/offline/database'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { syncAppBadge } from '../services/appBadge'
import { showUnreadMessageNotification } from '../services/messageNotifications'
import { notificationSettingsService } from '../services/notificationSettingsService'

const ChatContext = createContext(null)

function temporaryMessage(chatId, text, user) {
    const id = `offline-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
    return { id, chatId, text, sender: user, senderId: user.id, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), createdAt: new Date().toISOString(), isOwn: true, status: 'pending' }
}

function normalizeIncomingGroup(group) {
    return {
        ...group,
        type: 'group',
        memberCount: group.memberCount || group.members?.length || 0,
        lastMessage: group.lastMessage?.text || 'Group created',
        updatedAt: new Date(group.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        updatedAtValue: group.updatedAt,
        unreadCount: Number(group.unreadCount) || 0,
    }
}

export function ChatProvider({ children }) {
    const { user, token } = useAuth()
    const isOnline = useOnlineStatus()
    const [chats, setChats] = useState([])
    const [messagesByChat, setMessagesByChat] = useState({})
    const [activeChatId, setActiveChatId] = useState(null)
    const [searchResults, setSearchResults] = useState([])
    const [typingUsersByChat, setTypingUsersByChat] = useState({})
    const [unreadTotal, setUnreadTotal] = useState(0)
    const [notificationSettings, setNotificationSettings] = useState({ alertsEnabled: true, showPreview: true, mutedConversationIds: [] })
    const socketRef = useRef(null)
    const activeChatIdRef = useRef(null)
    const messageStatusByIdRef = useRef({})
    const typingTimeoutsRef = useRef({})
    const notificationSettingsRef = useRef(notificationSettings)
    const visibleConversationIdRef = useRef(null)

    const selectedChat = chats.find((chat) => chat.id === activeChatId) ?? null
    const activeMessages = selectedChat ? messagesByChat[selectedChat.id] ?? [] : []
    const persistChats = useCallback((nextChats) => { if (user?.id) saveConversations(user.id, nextChats).catch(() => {}) }, [user?.id])
    const persistMessages = useCallback((chatId, messages) => { if (user?.id) saveMessages(user.id, chatId, messages).catch(() => {}) }, [user?.id])

    const refreshChats = useCallback(async () => {
        if (!user?.id) return []
        const [nextChats, nextUnreadTotal] = await Promise.all([chatService.getChats(user.id), chatService.getUnreadCount()])
        setUnreadTotal(nextUnreadTotal)
        setChats((current) => {
            const merged = nextChats.map((chat) => ({
                ...chat,
                unreadCount: chat.unreadCount || 0,
            }))
            persistChats(merged)
            return merged
        })
        setActiveChatId((current) => (!current || !nextChats.some((chat) => chat.id === current)) && nextChats[0] ? nextChats[0].id : current)
        return nextChats
    }, [persistChats, user?.id])

    const refreshUnreadTotal = useCallback(async () => {
        if (!user?.id) return 0
        const total = await chatService.getUnreadCount()
        setUnreadTotal(total)
        return total
    }, [user?.id])

    const updateMessages = useCallback((chatId, updater) => {
        setMessagesByChat((current) => {
            const nextMessages = updater(current[chatId] || [])
            persistMessages(chatId, nextMessages)
            return { ...current, [chatId]: nextMessages }
        })
    }, [persistMessages])

    const flushOutbox = useCallback(async () => {
        if (!user?.id || !isOnline) return
        const queued = await getQueuedMessages(user.id).catch(() => [])
        for (const queuedMessage of queued) {
            updateMessages(queuedMessage.chatId, (messages) => messages.map((message) => message.id === queuedMessage.id ? { ...message, status: 'sending' } : message))
            try {
                const sent = await chatService.sendMessage(queuedMessage.chatId, queuedMessage.text, user.id, queuedMessage.replyTo?.id || null)
                updateMessages(queuedMessage.chatId, (messages) => messages.map((message) => message.id === queuedMessage.id ? { ...sent, isOwn: true } : message))
                await removeQueuedMessage(user.id, queuedMessage.id)
                await refreshChats().catch(() => {})
            } catch {
                updateMessages(queuedMessage.chatId, (messages) => messages.map((message) => message.id === queuedMessage.id ? { ...message, status: 'failed' } : message))
                break
            }
        }
    }, [isOnline, refreshChats, updateMessages, user?.id])

    useEffect(() => { activeChatIdRef.current = activeChatId }, [activeChatId])
    useEffect(() => { notificationSettingsRef.current = notificationSettings }, [notificationSettings])

    useEffect(() => {
        if (!user?.id) { setChats([]); setMessagesByChat({}); setActiveChatId(null); setUnreadTotal(0); return }
        loadConversations(user.id).then((cachedChats) => {
            if (cachedChats.length) { setChats(cachedChats); setUnreadTotal(cachedChats.reduce((total, chat) => total + (chat.unreadCount || 0), 0)); setActiveChatId((current) => current || cachedChats[0]?.id || null) }
        }).catch(() => {})
        notificationSettingsService.get().then(setNotificationSettings).catch(() => {})
        if (isOnline) refreshChats().catch(() => {})
    }, [isOnline, refreshChats, user?.id])

    useEffect(() => {
        if (!token || !user?.id) return undefined
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
        const socketUrl = import.meta.env.VITE_SOCKET_URL || apiUrl.replace(/\/api\/?$/, '')
        const socket = io(socketUrl, { auth: { token } })
        socketRef.current = socket
        socket.on('connect', () => {
            const chatId = activeChatIdRef.current
            if (chatId) socket.emit(chats.find(chat => chat.id === chatId)?.type === 'group' ? 'join_group' : 'join_chat', chats.find(chat => chat.id === chatId)?.type === 'group' ? { groupId: chatId } : { chatId })
            flushOutbox().catch(() => {})
        })
        socket.on('message_received', ({ message }) => {
            const normalized = { ...message, senderId: message.sender?.id || message.sender, timestamp: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isOwn: (message.sender?.id || message.sender) === user.id }
            updateMessages(message.chatId, (messages) => messages.some((item) => item.id === normalized.id) ? messages : [...messages, normalized])
            setChats((current) => {
                const isActive = visibleConversationIdRef.current === message.chatId
                const currentChat = current.find((chat) => chat.id === message.chatId)
                const updatedChat = currentChat && { ...currentChat, lastMessage: message.text, updatedAt: normalized.timestamp, updatedAtValue: message.createdAt, unreadCount: isActive ? 0 : (currentChat.unreadCount || 0) + 1 }
                const next = updatedChat ? [updatedChat, ...current.filter((chat) => chat.id !== message.chatId)] : current
                persistChats(next)
                return next
            })
            socket.emit('message_delivered', { messageId: message.id, chatId: message.chatId })
            if (visibleConversationIdRef.current === message.chatId) socket.emit('messages_read', { chatId: message.chatId })
            else {
                refreshUnreadTotal().catch(() => {})
                const settings = notificationSettingsRef.current
                if (settings.alertsEnabled && !settings.mutedConversationIds.includes(message.chatId)) showUnreadMessageNotification({ title: message.sender?.username || 'New message in Convo', body: settings.showPreview ? message.text : 'You have a new message', messageId: message.id })
            }
        })
        socket.on('group_message_received', ({ message, group }) => {
            const chatId = message.groupId
            const normalized = { ...message, chatId, senderId: message.sender?.id || message.sender, timestamp: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isOwn: false }
            updateMessages(chatId, messages => messages.some(item => item.id === normalized.id) ? messages : [...messages, normalized])
            setChats(current => {
                const active = visibleConversationIdRef.current === chatId
                const currentGroup = current.find(chat => chat.id === chatId)
                const incomingGroup = group ? normalizeIncomingGroup(group) : currentGroup
                if (!incomingGroup) return current
                const updatedGroup = { ...currentGroup, ...incomingGroup, lastMessage: message.text, updatedAt: normalized.timestamp, updatedAtValue: message.createdAt, unreadCount: active ? 0 : (group ? incomingGroup.unreadCount : (currentGroup.unreadCount || 0) + 1) }
                const next = [updatedGroup, ...current.filter(chat => chat.id !== chatId)]
                persistChats(next)
                return next
            })
            if (visibleConversationIdRef.current === chatId) socket.emit('messages_read', { chatId })
            else {
                refreshUnreadTotal().catch(() => {})
                const settings = notificationSettingsRef.current
                if (settings.alertsEnabled && !settings.mutedConversationIds.includes(chatId)) showUnreadMessageNotification({ title: group?.name || 'New group message', body: settings.showPreview ? message.text : 'You have a new message', messageId: message.id })
            }
        })
        socket.on('group_added', ({ group }) => { const normalized = normalizeIncomingGroup(group); setChats(current => { const next = [normalized, ...current.filter(chat => chat.id !== normalized.id)]; persistChats(next); return next }) })
        socket.on('group_updated', ({ group }) => { if (!group) return; const normalized = normalizeIncomingGroup(group); setChats(current => { const next = current.map(chat => chat.id === normalized.id ? { ...chat, ...normalized } : chat); persistChats(next); return next }) })
        socket.on('group_removed', ({ groupId }) => setChats(current => current.filter(chat => chat.id !== groupId)))
        socket.on('chat_deleted', ({ chatId }) => {
            setChats(current => {
                const next = current.filter(chat => chat.id !== chatId)
                persistChats(next)
                return next
            })
            setMessagesByChat(current => { const { [chatId]: _removed, ...next } = current; return next })
            deleteCachedMessages(user.id, chatId).catch(() => {})
            if (activeChatIdRef.current === chatId) setActiveChatId(null)
            refreshUnreadTotal().catch(() => {})
        })
        socket.on('message_status', ({ chatId, messageId, status, deliveredAt, readAt }) => {
            messageStatusByIdRef.current[messageId] = { status, deliveredAt, readAt, read: status === 'read' }
            updateMessages(chatId, (messages) => messages.map((message) => message.id === messageId ? { ...message, status, deliveredAt, readAt, read: status === 'read' } : message))
        })
        socket.on('message_updated', ({ message }) => {
            const normalized = { ...message, senderId: message.sender?.id || message.sender, timestamp: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isOwn: (message.sender?.id || message.sender) === user.id }
            updateMessages(message.chatId, (messages) => messages.map((item) => item.id === normalized.id ? normalized : item))
        })
        socket.on('message_deleted', ({ message }) => {
            const normalized = { ...message, senderId: message.sender?.id || message.sender, timestamp: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isOwn: (message.sender?.id || message.sender) === user.id }
            updateMessages(message.chatId, (messages) => messages.map((item) => item.id === normalized.id ? normalized : item))
        })
        socket.on('messages_read', ({ chatId, messageIds, readAt }) => {
            const ids = new Set(messageIds)
            messageIds.forEach((messageId) => { messageStatusByIdRef.current[messageId] = { status: 'read', read: true, readAt } })
            updateMessages(chatId, (messages) => messages.map((message) => ids.has(message.id) ? { ...message, status: 'read', read: true, readAt } : message))
        })
        socket.on('conversation_read', ({ chatId }) => {
            setChats((current) => {
                const next = current.map((chat) => chat.id === chatId ? { ...chat, unreadCount: 0 } : chat)
                persistChats(next)
                return next
            })
            refreshUnreadTotal().catch(() => {})
        })
        socket.on('typing_started', ({ userId, chatId }) => {
            if (!chatId || userId === user.id) return
            clearTimeout(typingTimeoutsRef.current[chatId]); setTypingUsersByChat((current) => ({ ...current, [chatId]: userId }))
            typingTimeoutsRef.current[chatId] = setTimeout(() => setTypingUsersByChat((current) => ({ ...current, [chatId]: null })), 3500)
        })
        socket.on('typing_stopped', ({ userId, chatId }) => { clearTimeout(typingTimeoutsRef.current[chatId]); setTypingUsersByChat((current) => current[chatId] === userId ? { ...current, [chatId]: null } : current) })
        socket.on('group_typing_started', ({ userId, groupId }) => {
            if (userId === user.id) return
            clearTimeout(typingTimeoutsRef.current[groupId]); setTypingUsersByChat(current => ({ ...current, [groupId]: userId }))
            typingTimeoutsRef.current[groupId] = setTimeout(() => setTypingUsersByChat(current => ({ ...current, [groupId]: null })), 3500)
        })
        socket.on('group_typing_stopped', ({ userId, groupId }) => { clearTimeout(typingTimeoutsRef.current[groupId]); setTypingUsersByChat(current => current[groupId] === userId ? { ...current, [groupId]: null } : current) })
        return () => { Object.values(typingTimeoutsRef.current).forEach(clearTimeout); typingTimeoutsRef.current = {}; socket.disconnect(); socketRef.current = null }
    }, [flushOutbox, persistChats, refreshUnreadTotal, token, updateMessages, user?.id])

    useEffect(() => { if (isOnline) flushOutbox().catch(() => {}) }, [flushOutbox, isOnline])

    useEffect(() => {
        if (!activeChatId || !user?.id) return undefined
        let active = true
        loadMessages(user.id, activeChatId).then((cached) => { if (active && cached.length) setMessagesByChat((current) => ({ ...current, [activeChatId]: cached })) }).catch(() => {})
        const activeChat = chats.find(chat => chat.id === activeChatId)
        if (isOnline) (activeChat?.type === 'group' ? chatService.getGroupMessages(activeChatId, user.id) : chatService.getMessages(activeChatId, user.id)).then((messages) => { if (active) updateMessages(activeChatId, () => messages) }).catch(() => {})
        const socket = socketRef.current
        socket?.emit(activeChat?.type === 'group' ? 'join_group' : 'join_chat', activeChat?.type === 'group' ? { groupId: activeChatId } : { chatId: activeChatId })
        return () => { active = false; socket?.emit(activeChat?.type === 'group' ? 'leave_group' : 'leave_chat', activeChat?.type === 'group' ? { groupId: activeChatId } : { chatId: activeChatId }) }
    }, [activeChatId, chats, isOnline, updateMessages, user?.id])

    const selectChat = (chatId) => {
        setActiveChatId(chatId)
    }

    const setConversationVisible = useCallback((chatId, visible) => {
        visibleConversationIdRef.current = visible ? chatId : null
        if (!visible || !chatId) return
        setChats((current) => {
            const next = current.map((chat) => chat.id === chatId ? { ...chat, unreadCount: 0 } : chat)
            persistChats(next)
            return next
        })
        socketRef.current?.emit('messages_read', { chatId })
    }, [persistChats])

    useEffect(() => {
        const openConversation = (chatId) => {
            if (!chatId || !chats.some(chat => chat.id === chatId)) return
            setActiveChatId(chatId)
            setChats((current) => {
                const next = current.map(chat => chat.id === chatId ? { ...chat, unreadCount: 0 } : chat)
                persistChats(next)
                return next
            })
        }
        const fromUrl = new URLSearchParams(window.location.search).get('chat')
        if (fromUrl) {
            openConversation(fromUrl)
            window.history.replaceState(window.history.state, '', window.location.pathname)
        }
        const onServiceWorkerMessage = event => {
            if (event.data?.type === 'OPEN_CONVERSATION') openConversation(event.data.conversationId)
        }
        navigator.serviceWorker?.addEventListener('message', onServiceWorkerMessage)
        return () => navigator.serviceWorker?.removeEventListener('message', onServiceWorkerMessage)
    }, [chats, persistChats])
    const startTyping = useCallback(() => { const group = selectedChat?.type === 'group'; if (activeChatId && isOnline) socketRef.current?.emit(group ? 'group_typing' : 'typing', group ? { groupId: activeChatId } : { chatId: activeChatId }) }, [activeChatId, isOnline, selectedChat?.type])
    const stopTyping = useCallback(() => { const group = selectedChat?.type === 'group'; if (activeChatId && isOnline) socketRef.current?.emit(group ? 'group_stop_typing' : 'stop_typing', group ? { groupId: activeChatId } : { chatId: activeChatId }) }, [activeChatId, isOnline, selectedChat?.type])
    const searchUsers = useCallback((query) => userService.searchUsers(query), [])

    const openChat = async (otherUser) => {
        const existing = chats.find((chat) => chat.participant.id === otherUser.id)
        if (existing) { setActiveChatId(existing.id); return existing }
        const nextChat = await chatService.createChat(otherUser.id, user.id)
        setChats((current) => { const next = [nextChat, ...current.filter((chat) => chat.id !== nextChat.id)]; persistChats(next); return next })
        setActiveChatId(nextChat.id)
        return nextChat
    }

    const sendMessage = async (text, replyTo = null) => {
        if (!activeChatId || !text.trim() || !user?.id) return null
        const socket = socketRef.current
        if (selectedChat?.type === 'group') {
            const message = await chatService.sendGroupMessage(activeChatId, text, user.id)
            const normalized = { ...message, isOwn: true }
            updateMessages(activeChatId, messages => [...messages, normalized])
            setChats(current => current.map(chat => chat.id === activeChatId ? { ...chat, lastMessage: normalized.text, updatedAt: normalized.timestamp } : chat))
            return normalized
        }
        if (isOnline && socket?.connected) {
            return new Promise((resolve, reject) => socket.emit('send_message', { chatId: activeChatId, text, replyTo: replyTo?.id || null }, (response) => {
                if (response?.error) return reject(new Error(response.error))
                const message = { ...response.message, ...(messageStatusByIdRef.current[response.message.id] || {}), senderId: user.id, timestamp: new Date(response.message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isOwn: true }
                updateMessages(activeChatId, (messages) => [...messages, message])
                setChats((current) => { const next = current.map((chat) => chat.id === activeChatId ? { ...chat, lastMessage: message.text, updatedAt: message.timestamp } : chat); persistChats(next); return next })
                resolve(message)
            }))
        }
        if (isOnline) {
            try {
                const message = await chatService.sendMessage(activeChatId, text, user.id, replyTo?.id || null)
                updateMessages(activeChatId, (messages) => [...messages, { ...message, isOwn: true }])
                return message
            } catch { /* Store the unsent message below. */ }
        }
        const pending = { ...temporaryMessage(activeChatId, text, user), replyTo }
        updateMessages(activeChatId, (messages) => [...messages, pending])
        await queueMessage(user.id, pending).catch(() => {})
        return pending
    }

    const editMessage = async (messageId, text) => {
        if (!user?.id) return null
        const updated = await chatService.editMessage(messageId, text, user.id)
        updateMessages(updated.chatId, (messages) => messages.map((message) => message.id === updated.id ? { ...updated, isOwn: true } : message))
        return updated
    }

    const deleteMessage = async (messageId) => {
        const message = activeMessages.find((item) => item.id === messageId)
        if (!message) return
        await chatService.deleteMessage(messageId)
        updateMessages(message.chatId, (messages) => messages.map((item) => item.id === messageId ? { ...item, text: 'This message was deleted', deleted: true, deletedAt: new Date().toISOString() } : item))
    }

    const deleteChat = async (chatId) => {
        const chat = chats.find(item => item.id === chatId)
        if (!chat || chat.type === 'group') throw new Error('Only private conversations can be deleted here')
        await chatService.deleteChat(chatId)
        const next = chats.filter(item => item.id !== chatId)
        setChats(next)
        persistChats(next)
        setMessagesByChat(current => { const { [chatId]: _removed, ...remaining } = current; return remaining })
        deleteCachedMessages(user.id, chatId).catch(() => {})
        if (activeChatId === chatId) setActiveChatId(next[0]?.id || null)
        if (visibleConversationIdRef.current === chatId) visibleConversationIdRef.current = null
        await refreshUnreadTotal().catch(() => {})
    }

    useEffect(() => {
        document.title = unreadTotal ? `(${unreadTotal > 99 ? '99+' : unreadTotal}) Convo` : 'Convo'
        syncAppBadge(unreadTotal)
        return () => { document.title = 'Convo' }
    }, [unreadTotal])

    const createGroup = async payload => { const group = await chatService.createGroup(payload, user.id); setChats(current => { const next = [group, ...current.filter(chat => chat.id !== group.id)]; persistChats(next); return next }); setActiveChatId(group.id); return group }
    const updateNotifications = async settings => { const next = await notificationSettingsService.update(settings); setNotificationSettings(next); return next }
    const value = useMemo(() => ({ chats, activeChatId, selectedChat, activeMessages, unreadTotal, notificationSettings, updateNotifications, typingUserId: selectedChat ? typingUsersByChat[selectedChat.id] : null, searchResults, selectChat, setConversationVisible, openChat, sendMessage, editMessage, deleteMessage, deleteChat, startTyping, stopTyping, refreshChats, refreshUnreadTotal, createGroup, setSearchResults, searchUsers }), [chats, activeChatId, selectedChat, activeMessages, unreadTotal, notificationSettings, typingUsersByChat, searchResults, searchUsers, setConversationVisible, startTyping, stopTyping, refreshChats, refreshUnreadTotal])
    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
    const context = useContext(ChatContext)
    if (!context) throw new Error('useChat must be used within a ChatProvider')
    return context
}
