import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import AuthForm from '../components/auth/AuthForm'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { login, setAuthError } = useAuth()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (values) => {
        try {
            setIsSubmitting(true)
            setError('')
            setAuthError('')
            await login({ email: values.email, password: values.password })
            navigate('/')
        } catch (err) {
            setError(err.message || 'Login failed.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h1>Welcome back</h1>
                <p>Sign in to continue chatting.</p>
                {location.state?.message && <p role="status">{location.state.message}</p>}
                <AuthForm type="login" submitLabel="Login" onSubmit={handleSubmit} isSubmitting={isSubmitting} submitError={error} />
                <div className="auth-switch"><Link to="/forgot-password">Forgot your password?</Link></div>
                <div className="auth-switch">
                    Need an account? <Link to="/register">Create one</Link>
                </div>
            </div>
        </div>
    )
}
