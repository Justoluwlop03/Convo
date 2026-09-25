import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { authService } from '../services/authService'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await authService.resetPassword(token, password)
      navigate('/login', { replace: true, state: { message: 'Password reset. Please sign in.' } })
    } catch (err) {
      setError(err.message || 'Unable to reset your password.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-page"><section className="auth-card">
    <h1>Choose a new password</h1>
    <p>Use at least 6 characters.</p>
    {!token ? <div className="inline-error">This reset link is missing its token.</div> : <form className="auth-form" onSubmit={handleSubmit}>
      <label className="field"><span>New password</span><input type="password" autoComplete="new-password" minLength={6} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} /></label>
      <label className="field"><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={6} maxLength={128} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label>
      {error && <div className="inline-error">{error}</div>}
      <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Reset password'}</button>
    </form>}
    <div className="auth-switch"><Link to="/login">Back to login</Link></div>
  </section></div>
}
