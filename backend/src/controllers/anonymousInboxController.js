import mongoose from 'mongoose'
import User from '../models/User.js'
import AnonymousMessage from '../models/AnonymousMessage.js'
import { httpError } from '../middleware/errorMiddleware.js'
import { sendAnonymousMessagePush } from '../utils/pushNotifications.js'

const messageView = message => ({ id: message._id.toString(), text: message.text, reported: message.reported, createdAt: message.createdAt })
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export async function getInboxSettings(req, res) {
  res.json({ enabled: req.user.anonymousInboxEnabled })
}

export async function updateInboxSettings(req, res) {
  if (typeof req.body?.enabled !== 'boolean') throw httpError(400, 'enabled must be a boolean')
  req.user.anonymousInboxEnabled = req.body.enabled
  await req.user.save()
  res.json({ enabled: req.user.anonymousInboxEnabled })
}

export async function sendAnonymousMessage(req, res) {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''
  if (!text || text.length > 1000) throw httpError(400, 'Write a message between 1 and 1000 characters')
  const username = String(req.params.username).trim()
  const recipient = await User.findOne({ username: { $regex: `^${escapeRegex(username)}$`, $options: 'i' } }).select('_id anonymousInboxEnabled')
  if (!recipient || !recipient.anonymousInboxEnabled) throw httpError(404, 'This inbox is unavailable')
  const message = await AnonymousMessage.create({ recipient: recipient._id, text })
  sendAnonymousMessagePush(recipient._id, { text, messageId: message._id.toString() }).catch(() => {})
  res.status(201).json({ sent: true })
}

export async function listAnonymousMessages(req, res) {
  const messages = await AnonymousMessage.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(100)
  res.json({ messages: messages.map(messageView) })
}

export async function deleteAnonymousMessage(req, res) {
  if (!mongoose.isValidObjectId(req.params.messageId)) throw httpError(404, 'Message not found')
  const result = await AnonymousMessage.deleteOne({ _id: req.params.messageId, recipient: req.user._id })
  if (!result.deletedCount) throw httpError(404, 'Message not found')
  res.json({ deleted: true })
}

export async function reportAnonymousMessage(req, res) {
  if (!mongoose.isValidObjectId(req.params.messageId)) throw httpError(404, 'Message not found')
  const message = await AnonymousMessage.findOneAndUpdate({ _id: req.params.messageId, recipient: req.user._id }, { reported: true }, { new: true })
  if (!message) throw httpError(404, 'Message not found')
  res.json({ message: messageView(message) })
}
