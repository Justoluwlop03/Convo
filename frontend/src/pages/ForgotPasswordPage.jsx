import { Link } from 'react-router-dom'
import { useState } from 'react'
import { authService } from '../services/authService'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await authService.requestPasswordReset(email)
      setMessage(result.message)
    } catch (err) {
      setError(err.message || 'Unable to request a password reset.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-page"><section className="auth-card">
    <h1>Forgot password?</h1>
    <p>Enter the email address for your account and we’ll send a reset link.</p>
    <form className="auth-form" onSubmit={handleSubmit}>
      <label className="field"><span>Email</span><input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>
      {error && <div className="inline-error">{error}</div>}
      {message && <p role="status">{message}</p>}
      <button className="primary-button" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
    </form>
    <div className="auth-switch"><Link to="/login">Back to login</Link></div>
  </section></div>
}
