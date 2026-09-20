import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { authService } from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(() => localStorage.getItem('chat_token'))
    const [loading, setLoading] = useState(true)
    const [authError, setAuthError] = useState('')

    useEffect(() => {
        const restoreSession = async () => {
            try {
                const storedToken = localStorage.getItem('chat_token')
                if (!storedToken) {
                    setUser(null)
                    setLoading(false)
                    return
                }

                const { user: currentUser } = await authService.me()
                setUser(currentUser)
            } catch (error) {
                console.error('Session restore failed', error)
                localStorage.removeItem('chat_token')
                setUser(null)
            } finally {
                setLoading(false)
            }
        }

        restoreSession()
    }, [])

    const setSession = (nextToken, nextUser) => {
        setToken(nextToken)
        setUser(nextUser)
        localStorage.setItem('chat_token', nextToken)
    }

    const login = async (credentials) => {
        setAuthError('')
        const response = await authService.login(credentials)
        setSession(response.token, response.user)
        return response
    }

    const register = async (payload) => {
        setAuthError('')
        const response = await authService.register(payload)
        setSession(response.token, response.user)
        return response
    }

    const logout = () => {
        setAuthError('')
        setUser(null)
        setToken(null)
        localStorage.removeItem('chat_token')
    }

    const value = useMemo(
        () => ({
            user,
            token,
            loading,
            authError,
            setAuthError,
            login,
            register,
            logout,
            setSession,
        }),
        [user, token, loading, authError],
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext)

    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }

    return context
}
