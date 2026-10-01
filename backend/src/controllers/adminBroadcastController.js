import { z } from 'zod'
import mongoose from 'mongoose'
import AdminBroadcast from '../models/AdminBroadcast.js'
import User from '../models/User.js'

const broadcastInput = z.object({
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(12000),
})

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}

function broadcastView(broadcast) {
  return {
    id: broadcast._id.toString(), subject: broadcast.subject,
    recipientsCount: broadcast.recipientsCount, sentCount: broadcast.sentCount,
    status: broadcast.status, error: broadcast.error, createdAt: broadcast.createdAt,
    completedAt: broadcast.completedAt,
  }
}

async function deliverBroadcast(broadcastId, recipients, subject, message) {
  const broadcast = await AdminBroadcast.findById(broadcastId)
  if (!broadcast) return
  broadcast.status = 'sending'
  await broadcast.save()

  try {
    const endpoint = 'https://api.brevo.com/v3/smtp/email'
    const paragraphs = escapeHtml(message).split(/\r?\n/).map(line => `<p style="margin:0 0 14px;line-height:1.6">${line || '&nbsp;'}</p>`).join('')
    const htmlContent = `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#172942"><main style="max-width:600px;margin:0 auto;padding:28px;background:#fff;border:1px solid #dbe5f1;border-radius:16px"><h1 style="margin:0 0 22px;color:#2563eb;font-size:20px">Convo</h1>${paragraphs}</main></body></html>`
    const batchSize = 100
    for (let offset = 0; offset < recipients.length; offset += batchSize) {
      const batch = recipients.slice(offset, offset + batchSize)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'Convo' },
          subject, htmlContent, textContent: message,
          messageVersions: batch.map(email => ({ to: [{ email }] })),
        }),
      })
      if (!response.ok) {
        let reason = `Email provider returned HTTP ${response.status}`
        try {
          const details = await response.json()
          reason = details.message || details.code || reason
        } catch {}
        throw new Error(reason)
      }
      broadcast.sentCount += batch.length
      await broadcast.save()
    }
    broadcast.status = 'sent'
    broadcast.completedAt = new Date()
    await broadcast.save()
  } catch (error) {
    broadcast.status = 'failed'
    broadcast.error = String(error.message || 'Email delivery failed').slice(0, 300)
    broadcast.completedAt = new Date()
    await broadcast.save()
  }
}

export async function listAdminBroadcasts(req, res) {
  const broadcasts = await AdminBroadcast.find().sort({ createdAt: -1 }).limit(10).lean()
  res.json({ broadcasts: broadcasts.map(broadcastView) })
}

export async function deleteAdminBroadcast(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Broadcast not found.' })
  const broadcast = await AdminBroadcast.findOneAndDelete({
    _id: req.params.id,
    status: { $in: ['sent', 'failed'] },
  })
  if (broadcast) return res.json({ deleted: true, id: broadcast._id.toString() })
  const exists = await AdminBroadcast.exists({ _id: req.params.id })
  if (!exists) return res.status(404).json({ message: 'Broadcast not found.' })
  return res.status(409).json({ message: 'A queued or sending broadcast cannot be deleted.' })
}

export async function createAdminBroadcast(req, res) {
  const parsed = broadcastInput.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message })
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    return res.status(503).json({ message: 'Broadcast email is unavailable. Configure BREVO_API_KEY and BREVO_SENDER_EMAIL on the backend.' })
  }

  const recipients = await User.find({}, { email: 1, _id: 0 }).lean()
  const emails = [...new Set(recipients.map(user => user.email?.trim().toLowerCase()).filter(Boolean))]
  if (!emails.length) return res.status(400).json({ message: 'There are no user email addresses to send to.' })

  const broadcast = await AdminBroadcast.create({
    subject: parsed.data.subject,
    message: parsed.data.message,
    recipientsCount: emails.length,
    createdBy: req.user._id,
  })
  res.status(202).json({ broadcast: broadcastView(broadcast) })
  setImmediate(() => deliverBroadcast(broadcast._id, emails, parsed.data.subject, parsed.data.message))
}
