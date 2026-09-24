import api from './api'

export const userService = {
    async getFriends(userId) { const { data } = await api.get(userId ? `/users/${userId}/friends` : '/users/friends'); return data.users },
    async getRecommendedUsers() {
        const { data } = await api.get('/users/recommended')
        return data.users
    },

    async searchUsers(query) {
        const q = (query || '').trim()
        if (!q) return []
        const { data } = await api.get('/users/search', { params: { q } })
        return data.users
    },

    async getUser(userId) {
        const { data } = await api.get(`/users/${userId}`)
        return data.user
    },

    async sendFriendRequest(userId) {
        const { data } = await api.post(`/users/${userId}/friend-request`)
        return data.user
    },

    async blockUser(userId) {
        const { data } = await api.post(`/users/${userId}/block`)
        return data.user
    },

    async unblockUser(userId) {
        const { data } = await api.delete(`/users/${userId}/block`)
        return data.user
    },

    async getFriendRequests() {
        const { data } = await api.get('/users/friend-requests')
        return data.requests
    },

    async acceptFriendRequest(userId) {
        const { data } = await api.post(`/users/friend-requests/${userId}/accept`)
        return data.user
    },

    async declineFriendRequest(userId) {
        const { data } = await api.post(`/users/friend-requests/${userId}/decline`)
        return data.user
    },
}
