import api from './api'

function getApiError(error, fallbackMessage) {
    const message = error.response?.data?.message
    throw new Error(message || fallbackMessage)
}

export const authService = {
    async requestPasswordReset(email) {
        try {
            const { data } = await api.post('/auth/forgot-password', { email })
            return data
        } catch (error) {
            getApiError(error, 'Unable to request a password reset.')
        }
    },

    async resetPassword(token, password) {
        try {
            const { data } = await api.post('/auth/reset-password', { token, password })
            return data
        } catch (error) {
            getApiError(error, 'Unable to reset your password.')
        }
    },

    async login(credentials) {
        try {
            const { data } = await api.post('/auth/login', credentials)
            return data
        } catch (error) {
            getApiError(error, 'Unable to log in.')
        }
    },

    async register(payload) {
        try {
            const { data } = await api.post('/auth/register', payload)
            return data
        } catch (error) {
            getApiError(error, 'Unable to create account.')
        }
    },

    async me() {
        const { data } = await api.get('/auth/me')
        return data
    },
}
