import mongoose from 'mongoose'
import { z } from 'zod'
import Message from '../models/Message.js'
import Chat from '../models/Chat.js'
import { httpError } from '../middleware/errorMiddleware.js'

const messageInput = z.object({ chatId: z.string(), text: z.string().trim().min(1).max(5000) })
const messageView = message => {
  const readAt = message.readAt || (message.read ? message.updatedAt : null)
  const deliveredAt = message.deliveredAt || readAt
  return {
    id: message._id.toString(),
    chatId: message.chat._id?.toString?.() || message.chat.toString(),
    sender: message.sender.toPublicJSON(),
    text: message.text,
    read: Boolean(readAt),
    deliveredAt,
    readAt,
    status: readAt ? 'read' : deliveredAt ? 'delivered' : 'sent',
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  }
}

async function memberChat(chatId, userId) {
  if (!mongoose.isValidObjectId(chatId)) throw httpError(400, 'Invalid chat id')
  const chat = await Chat.findOne({ _id: chatId, participants: userId })
  if (!chat) throw httpError(404, 'Chat not found')
  return chat
}

export async function getMessages(req, res) {
  const chat = await memberChat(req.params.chatId, req.user._id)
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1)
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), 100)
  const [messages, total] = await Promise.all([
    Message.find({ chat: chat._id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('sender', '-passwordHash'),
    Message.countDocuments({ chat: chat._id }),
  ])
  res.json({ messages: messages.reverse().map(messageView), page, limit, total, pages: Math.ceil(total / limit) })
}

export async function createMessage(req, res) {
  const input = messageInput.safeParse(req.body)
  if (!input.success) throw httpError(400, input.error.issues[0].message)
  const chat = await memberChat(input.data.chatId, req.user._id)
  const message = await Message.create({ chat: chat._id, sender: req.user._id, text: input.data.text })
  await Chat.findByIdAndUpdate(chat._id, { lastMessage: message._id })
  const populated = await message.populate('sender', '-passwordHash')
  res.status(201).json({ message: messageView(populated) })
}

export async function markRead(req, res) {
  const message = await Message.findOne({ _id: req.params.id, sender: { $ne: req.user._id } })
  if (!message) throw httpError(404, 'Message not found')
  await memberChat(message.chat, req.user._id)
  message.read = true
  message.deliveredAt ||= new Date()
  message.readAt = new Date()
  await message.save()
  res.json({ message: { id: message._id.toString(), read: true, deliveredAt: message.deliveredAt, readAt: message.readAt, status: 'read' } })
}

export async function deleteMessage(req, res) {
  const message = await Message.findOne({ _id: req.params.id, sender: req.user._id })
  if (!message) throw httpError(404, 'Message not found')
  await message.deleteOne()
  res.status(204).end()
}
