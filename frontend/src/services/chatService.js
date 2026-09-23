import api from './api'

function participantFor(chat, currentUserId) {
    return chat.participants.find((participant) => participant.id !== currentUserId) || chat.participants[0]
}

function formatTime(value) {
    if (!value) return ''
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function normalizeChat(chat, currentUserId) {
    if (chat.type === 'group') return {
        id: chat.id, type: 'group', name: chat.name, avatar: chat.avatar, members: chat.members || [], admins: chat.admins || [], creator: chat.creator,
        memberCount: chat.memberCount || chat.members?.length || 0, locked: Boolean(chat.locked), lastMessage: chat.lastMessage?.text || 'Group created', updatedAt: formatTime(chat.updatedAt), updatedAtValue: chat.updatedAt, unreadCount: Number(chat.unreadCount) || 0,
    }
    return {
        id: chat.id,
        participant: participantFor(chat, currentUserId),
        lastMessage: chat.lastMessage?.text || 'Start a conversation',
        updatedAt: formatTime(chat.updatedAt),
        updatedAtValue: chat.updatedAt,
        unreadCount: Number(chat.unreadCount) || 0,
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
    async getUnreadCount() { const { data } = await api.get('/chats/unread-count'); return Number(data.unreadCount) || 0 },
    async getChats(currentUserId) {
        const [chatsResult, groupsResult] = await Promise.all([api.get('/chats'), api.get('/groups')])
        return [...chatsResult.data.chats, ...groupsResult.data.groups].map((chat) => normalizeChat(chat, currentUserId)).sort((a, b) => new Date(b.updatedAtValue) - new Date(a.updatedAtValue))
    },

    async getMessages(chatId, currentUserId) {
        const { data } = await api.get(`/messages/${chatId}`)
        return data.messages.map((message) => normalizeMessage(message, currentUserId))
    },

    async createChat(userId, currentUserId) {
        const { data } = await api.post('/chats', { userId })
        return normalizeChat(data.chat, currentUserId)
    },

    async deleteChat(chatId) {
        await api.delete(`/chats/${chatId}`)
    },

    async sendMessage(chatId, text, currentUserId, replyTo = null) {
        const { data } = await api.post('/messages', { chatId, text, replyTo })
        return normalizeMessage(data.message, currentUserId)
    },

    async getGroupMessages(groupId, currentUserId) { const { data } = await api.get(`/groups/${groupId}/messages`); return data.messages.map((message) => normalizeMessage(message, currentUserId)) },
    async createGroup({ name, memberIds, avatar }, currentUserId) { const form = new FormData(); form.append('name', name); form.append('memberIds', JSON.stringify(memberIds)); if (avatar) form.append('avatar', avatar); const { data } = await api.post('/groups', form); return normalizeChat(data.group, currentUserId) },
    async updateGroup(groupId, payload, currentUserId) { const form = new FormData(); if (payload.name) form.append('name', payload.name); if (payload.avatar) form.append('avatar', payload.avatar); const { data } = await api.patch(`/groups/${groupId}`, form); return normalizeChat(data.group, currentUserId) },
    async addGroupMembers(groupId, memberIds, currentUserId) { const { data } = await api.post(`/groups/${groupId}/members`, { memberIds }); return normalizeChat(data.group, currentUserId) },
    async removeGroupMember(groupId, userId) { await api.delete(`/groups/${groupId}/members/${userId}`) },
    async setGroupLock(groupId, locked) { const { data } = await api.patch(`/groups/${groupId}/lock`, { locked }); return normalizeChat(data.group) },
    async leaveGroup(groupId) { await api.post(`/groups/${groupId}/leave`) },
    async deleteGroup(groupId) { await api.delete(`/groups/${groupId}`) },
    async sendGroupMessage(groupId, text, currentUserId) { const { data } = await api.post(`/groups/${groupId}/messages`, { text }); return normalizeMessage(data.message, currentUserId) },

    async editMessage(messageId, text, currentUserId) {
        const { data } = await api.patch(`/messages/${messageId}`, { text })
        return normalizeMessage(data.message, currentUserId)
    },

    async deleteMessage(messageId) {
        await api.delete(`/messages/${messageId}`)
    },
}
