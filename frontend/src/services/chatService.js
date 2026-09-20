import api from './api'

function participantFor(chat, currentUserId) {
    return chat.participants.find((participant) => participant.id !== currentUserId) || chat.participants[0]
}

function formatTime(value) {
    if (!value) return ''
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function normalizeChat(chat, currentUserId) {
    return {
        id: chat.id,
        participant: participantFor(chat, currentUserId),
        lastMessage: chat.lastMessage?.text || 'Start a conversation',
        updatedAt: formatTime(chat.updatedAt),
        unreadCount: 0,
    }
}

function normalizeMessage(message, currentUserId) {
    return {
        ...message,
        senderId: message.sender?.id || message.sender,
        timestamp: formatTime(message.createdAt),
        isOwn: (message.sender?.id || message.sender) === currentUserId,
    }
}

export const chatService = {
    async getChats(currentUserId) {
        const { data } = await api.get('/chats')
        return data.chats.map((chat) => normalizeChat(chat, currentUserId))
    },

    async getMessages(chatId, currentUserId) {
        const { data } = await api.get(`/messages/${chatId}`)
        return data.messages.map((message) => normalizeMessage(message, currentUserId))
    },

    async createChat(userId, currentUserId) {
        const { data } = await api.post('/chats', { userId })
        return normalizeChat(data.chat, currentUserId)
    },

    async sendMessage(chatId, text, currentUserId, replyTo = null) {
        const { data } = await api.post('/messages', { chatId, text, replyTo })
        return normalizeMessage(data.message, currentUserId)
    },

    async editMessage(messageId, text, currentUserId) {
        const { data } = await api.patch(`/messages/${messageId}`, { text })
        return normalizeMessage(data.message, currentUserId)
    },

    async deleteMessage(messageId) {
        await api.delete(`/messages/${messageId}`)
    },
}
