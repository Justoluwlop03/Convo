import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { chatService } from '../services/chatService'
import { userService } from '../services/userService'

const ChatContext = createContext(null)

export function ChatProvider({ children }) {
    const { user, token } = useAuth()
    const [chats, setChats] = useState([])
    const [messagesByChat, setMessagesByChat] = useState({})
    const [activeChatId, setActiveChatId] = useState(null)
    const [searchResults, setSearchResults] = useState([])
    const [typingUsersByChat, setTypingUsersByChat] = useState({})
    const socketRef = useRef(null)
    const activeChatIdRef = useRef(null)
    const messageStatusByIdRef = useRef({})
    const typingTimeoutsRef = useRef({})

    const selectedChat = chats.find((chat) => chat.id === activeChatId) ?? null
    const activeMessages = selectedChat ? messagesByChat[selectedChat.id] ?? [] : []

    useEffect(() => {
        activeChatIdRef.current = activeChatId
    }, [activeChatId])

    const refreshChats = async () => {
        if (!user?.id) return
        const nextChats = await chatService.getChats(user.id)
        setChats(nextChats)
        if ((!activeChatId || !nextChats.some((chat) => chat.id === activeChatId)) && nextChats[0]) {
            setActiveChatId(nextChats[0].id)
        }
    }

    useEffect(() => {
        if (!token || !user?.id) return undefined
        refreshChats().catch(() => setChats([]))

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
        const socketUrl = apiUrl.replace(/\/api\/?$/, '')
        const socket = io(socketUrl, { auth: { token } })
        socketRef.current = socket

        socket.on('connect', () => {
            const chatId = activeChatIdRef.current
            if (!chatId) return
            socket.emit('join_chat', { chatId })
            socket.emit('messages_read', { chatId })
        })

        socket.on('message_received', ({ message }) => {
            const normalizedMessage = {
                ...message,
                senderId: message.sender?.id || message.sender,
                timestamp: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isOwn: (message.sender?.id || message.sender) === user.id,
            }
            setMessagesByChat((current) => {
                const existing = current[message.chatId] || []
                if (existing.some((item) => item.id === normalizedMessage.id)) return current
                return { ...current, [message.chatId]: [...existing, normalizedMessage] }
            })
            setChats((current) => current.map((chat) => chat.id === message.chatId
                ? { ...chat, lastMessage: message.text, updatedAt: normalizedMessage.timestamp }
                : chat))
            socket.emit('message_delivered', { messageId: message.id, chatId: message.chatId })
            if (activeChatIdRef.current === message.chatId) {
                socket.emit('messages_read', { chatId: message.chatId })
            }
        })

        socket.on('message_status', ({ chatId, messageId, status, deliveredAt, readAt }) => {
            messageStatusByIdRef.current[messageId] = { status, deliveredAt, readAt, read: status === 'read' }
            setMessagesByChat((current) => ({
                ...current,
                [chatId]: (current[chatId] || []).map((message) => message.id === messageId
                    ? { ...message, status, deliveredAt, readAt, read: status === 'read' }
                    : message),
            }))
        })

        socket.on('messages_read', ({ chatId, messageIds, readAt }) => {
            const readMessageIds = new Set(messageIds)
            messageIds.forEach((messageId) => {
                messageStatusByIdRef.current[messageId] = { status: 'read', read: true, deliveredAt: readAt, readAt }
            })
            setMessagesByChat((current) => ({
                ...current,
                [chatId]: (current[chatId] || []).map((message) => readMessageIds.has(message.id)
                    ? { ...message, status: 'read', read: true, deliveredAt: readAt, readAt }
                    : message),
            }))
        })

        socket.on('typing_started', ({ userId, chatId }) => {
            if (!chatId || userId === user.id) return
            clearTimeout(typingTimeoutsRef.current[chatId])
            setTypingUsersByChat((current) => ({ ...current, [chatId]: userId }))
            typingTimeoutsRef.current[chatId] = setTimeout(() => {
                setTypingUsersByChat((current) => ({ ...current, [chatId]: null }))
            }, 3500)
        })

        socket.on('typing_stopped', ({ userId, chatId }) => {
            clearTimeout(typingTimeoutsRef.current[chatId])
            setTypingUsersByChat((current) => current[chatId] === userId ? { ...current, [chatId]: null } : current)
        })

        return () => {
            Object.values(typingTimeoutsRef.current).forEach(clearTimeout)
            typingTimeoutsRef.current = {}
            socket.disconnect()
            socketRef.current = null
        }
    }, [token, user?.id])

    useEffect(() => {
        if (!activeChatId || !user?.id) return undefined
        chatService.getMessages(activeChatId, user.id)
            .then((messages) => {
                setMessagesByChat((current) => ({ ...current, [activeChatId]: messages }))
                socketRef.current?.emit('messages_read', { chatId: activeChatId })
            })
            .catch(() => setMessagesByChat((current) => ({ ...current, [activeChatId]: [] })))

        const socket = socketRef.current
        if (!socket) return undefined
        socket.emit('join_chat', { chatId: activeChatId })
        return () => socket.emit('leave_chat', { chatId: activeChatId })
    }, [activeChatId, user?.id])

    const selectChat = (chatId) => {
        setActiveChatId(chatId)
    }

    const startTyping = useCallback(() => {
        if (activeChatId) socketRef.current?.emit('typing', { chatId: activeChatId })
    }, [activeChatId])

    const stopTyping = useCallback(() => {
        if (activeChatId) socketRef.current?.emit('stop_typing', { chatId: activeChatId })
    }, [activeChatId])

    const searchUsers = useCallback((query) => userService.searchUsers(query), [])

    const openChat = async (otherUser) => {
        const existingChat = chats.find((chat) => chat.participant.id === otherUser.id)
        if (existingChat) {
            setActiveChatId(existingChat.id)
            return existingChat
        }

        const newChat = await chatService.createChat(otherUser.id, user.id)
        setChats((current) => [newChat, ...current.filter((chat) => chat.id !== newChat.id)])
        setActiveChatId(newChat.id)
        return newChat
    }

    const sendMessage = async (text) => {
        if (!activeChatId || !text.trim() || !user?.id) return null
        const socket = socketRef.current
        if (socket?.connected) {
            return new Promise((resolve, reject) => {
                socket.emit('send_message', { chatId: activeChatId, text }, (response) => {
                    if (response?.error) return reject(new Error(response.error))
                    const message = {
                        ...response.message,
                        ...(messageStatusByIdRef.current[response.message.id] || {}),
                        senderId: user.id,
                        timestamp: new Date(response.message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        isOwn: true,
                    }
                    setMessagesByChat((current) => ({ ...current, [activeChatId]: [...(current[activeChatId] || []), message] }))
                    setChats((current) => current.map((chat) => chat.id === activeChatId ? { ...chat, lastMessage: message.text, updatedAt: message.timestamp } : chat))
                    resolve(message)
                })
            })
        }
        const message = await chatService.sendMessage(activeChatId, text, user.id)
        setMessagesByChat((current) => ({ ...current, [activeChatId]: [...(current[activeChatId] || []), message] }))
        return message
    }

    const value = useMemo(
        () => ({
            chats,
            activeChatId,
            selectedChat,
            activeMessages,
            typingUserId: selectedChat ? typingUsersByChat[selectedChat.id] : null,
            searchResults,
            selectChat,
            searchUsers,
            openChat,
            sendMessage,
            startTyping,
            stopTyping,
            refreshChats,
            setSearchResults,
        }),
        [chats, activeChatId, selectedChat, activeMessages, typingUsersByChat, searchResults, searchUsers, startTyping, stopTyping],
    )

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
    const context = useContext(ChatContext)

    if (!context) {
        throw new Error('useChat must be used within a ChatProvider')
    }

    return context
}
