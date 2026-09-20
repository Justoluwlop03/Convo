import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import AuthForm from '../components/auth/AuthForm'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
    const navigate = useNavigate()
    const { register: registerUser, setAuthError } = useAuth()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (values) => {
        try {
            setIsSubmitting(true)
            setError('')
            setAuthError('')
            await registerUser({ username: values.username, email: values.email, password: values.password })
            navigate('/')
        } catch (err) {
            setError(err.message || 'Registration failed.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h1>Create account</h1>
                <p>Join your teammates and start messaging.</p>
                <AuthForm type="register" submitLabel="Register" onSubmit={handleSubmit} isSubmitting={isSubmitting} submitError={error} />
                <div className="auth-switch">
                    Already have an account? <Link to="/login">Login</Link>
                </div>
            </div>
        </div>
    )
}
