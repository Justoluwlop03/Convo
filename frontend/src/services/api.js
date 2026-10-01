import axios from 'axios'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
    timeout: 10000,
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('chat_token')

    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }

    return config
})

api.interceptors.response.use((response) => response, (error) => {
    if (error.response?.data?.code === 'ACCOUNT_BANNED') {
        localStorage.removeItem('chat_token')
        window.dispatchEvent(new Event('convo-account-banned'))
    }
    return Promise.reject(error)
})

export default api
