import api from './api'

export const userService = {
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
}
