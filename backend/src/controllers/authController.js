import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import User from '../models/User.js'
import { generateToken } from '../utils/generateToken.js'
import { httpError } from '../middleware/errorMiddleware.js'
import { deleteAvatar, uploadAvatar } from '../config/cloudinary.js'

const credentials = z.object({
  // Mongoose normalizes stored addresses to lowercase. Normalize the login
  // input too, so an address entered with capital letters still matches.
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
})
const registration = credentials.extend({ username: z.string().trim().min(2).max(30) })
const profileUpdate = z.object({
  username: z.string().trim().min(2).max(30).optional(),
  displayName: z.string().trim().max(50).optional(),
  bio: z.string().trim().max(160).optional(),
  about: z.string().trim().max(1000).optional(),
})
const resetRequest = z.object({ email: z.string().trim().toLowerCase().email() })
const resetPassword = z.object({ token: z.string().min(32).max(256), password: z.string().min(6).max(128) })

function hashResetToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

async function sendPasswordResetEmail(email, link) {
  const apiKey = process.env.BREVO_API_KEY
  const senderEmail = process.env.BREVO_SENDER_EMAIL
  const senderName = process.env.BREVO_SENDER_NAME || 'Convo'
  if (!apiKey || !senderEmail) throw new Error('Password reset email is not configured')

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email }],
      subject: 'Reset your Convo password',
      htmlContent: `
        <!doctype html>
        <html lang="en">
          <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
          <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:40px 16px">
              <tr><td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden">
                  <tr><td style="padding:28px 36px;background:#1d4ed8;color:#ffffff">
                    <div style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Convo</div>
                    <div style="margin-top:8px;font-size:25px;font-weight:700;line-height:1.25">Reset your password</div>
                  </td></tr>
                  <tr><td style="padding:32px 36px 12px;font-size:16px;line-height:1.6">
                    <p style="margin:0 0 16px">We received a request to reset the password for your Convo account.</p>
                    <p style="margin:0 0 24px;color:#475569">Choose a new password by clicking the button below. This link expires in <strong>30 minutes</strong>.</p>
                    <p style="margin:0 0 28px"><a href="${link}" style="display:inline-block;padding:14px 24px;border-radius:10px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700">Reset password</a></p>
                    <p style="margin:0 0 8px;color:#64748b;font-size:13px">If the button doesn’t work, copy this link into your browser:</p>
                    <p style="margin:0 0 24px;overflow-wrap:anywhere;font-size:13px"><a href="${link}" style="color:#2563eb">${link}</a></p>
                    <p style="margin:0;color:#64748b;font-size:14px">If you didn’t request a password reset, you can safely ignore this email. Your password won’t change.</p>
                  </td></tr>
                  <tr><td style="padding:18px 36px 24px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px">Convo account security</td></tr>
                </table>
              </td></tr>
            </table>
          </body>
        </html>`,
      textContent: `Use this link to choose a new password. It expires in 30 minutes:\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
    }),
  })
  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Password reset email delivery failed (${response.status}): ${details.slice(0, 500)}`)
  }
}

export async function requestPasswordReset(req, res) {
  const { email } = parse(resetRequest, req.body)
  const user = await User.findOne({ email })
  if (user) {
    const token = randomBytes(32).toString('hex')
    user.passwordResetTokenHash = hashResetToken(token)
    user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000)
    await user.save()
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '')
    await sendPasswordResetEmail(email, `${clientUrl}/reset-password?token=${encodeURIComponent(token)}`)
  }
  res.json({ message: 'If an account exists for that email, a password reset link will be sent.' })
}

export async function completePasswordReset(req, res) {
  const { token, password } = parse(resetPassword, req.body)
  const user = await User.findOne({
    passwordResetTokenHash: hashResetToken(token),
    passwordResetExpiresAt: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpiresAt')
  if (!user) throw httpError(400, 'This reset link is invalid or has expired')

  user.passwordHash = await bcrypt.hash(password, 12)
  user.passwordResetTokenHash = undefined
  user.passwordResetExpiresAt = undefined
  await user.save()
  res.json({ message: 'Password has been reset. You can now sign in.' })
}

function parse(schema, data) {
  const result = schema.safeParse(data)
  if (!result.success) throw httpError(400, result.error.issues[0].message)
  return result.data
}

function authResponse(user) {
  return { user: user.toPublicJSON(), token: generateToken(user._id) }
}

export async function register(req, res) {
  const input = parse(registration, req.body)
  const [emailExists, usernameExists] = await Promise.all([User.exists({ email: input.email }), User.exists({ username: input.username })])
  if (emailExists) throw httpError(409, 'Email is already registered')
  if (usernameExists) throw httpError(409, 'Username is already taken')
  const user = await User.create({ ...input, passwordHash: await bcrypt.hash(input.password, 12), isOnline: true })
  res.status(201).json(authResponse(user))
}

export async function login(req, res) {
  const input = parse(credentials, req.body)
  const user = await User.findOne({ email: input.email }).select('+passwordHash')
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) throw httpError(401, 'Invalid email or password')
  user.isOnline = true
  await user.save()
  res.json(authResponse(user))
}

export async function me(req, res) {
  res.json({ user: req.user.toPublicJSON() })
}

export async function updateProfile(req, res) {
  const input = parse(profileUpdate, req.body)
  if (input.username && input.username !== req.user.username) {
    const usernameExists = await User.exists({ username: input.username, _id: { $ne: req.user._id } })
    if (usernameExists) throw httpError(409, 'Username is already taken')
    req.user.username = input.username
  }
  if (input.bio !== undefined) req.user.bio = input.bio
  if (input.displayName !== undefined) req.user.displayName = input.displayName
  if (input.about !== undefined) req.user.about = input.about
  await req.user.save()
  res.json({ user: req.user.toPublicJSON() })
}

export async function updateAvatar(req, res) {
  if (!req.file) throw httpError(400, 'An image file is required')

  const previousAvatarPublicId = req.user.avatarPublicId
  const result = await uploadAvatar(req.file.buffer)
  req.user.avatar = result.secure_url
  req.user.avatarPublicId = result.public_id
  await req.user.save()
  if (previousAvatarPublicId) await deleteAvatar(previousAvatarPublicId)
  res.json({ user: req.user.toPublicJSON() })
}

export async function deleteAvatarImage(req, res) {
  if (req.user.avatarPublicId) await deleteAvatar(req.user.avatarPublicId)
  req.user.avatar = ''
  req.user.avatarPublicId = ''
  await req.user.save()
  res.json({ user: req.user.toPublicJSON() })
}
