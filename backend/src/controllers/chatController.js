import mongoose from 'mongoose'
import Chat from '../models/Chat.js'
import User from '../models/User.js'
import Message from '../models/Message.js'
import { httpError } from '../middleware/errorMiddleware.js'

const chatView = (chat, unreadCount = 0) => ({
  id: chat._id.toString(),
  participants: chat.participants.map(participant => participant.toPublicJSON()),
  lastMessage: chat.lastMessage ? {
    ...chat.lastMessage.toObject?.(),
    text: chat.lastMessage.deletedAt ? 'Message deleted' : chat.lastMessage.text,
  } : null,
  createdAt: chat.createdAt,
  updatedAt: chat.updatedAt,
  unreadCount,
})

async function unreadCountsFor(chats, userId) {
  if (!chats.length) return new Map()
  const counts = await Message.aggregate([
    { $match: { chat: { $in: chats.map(chat => chat._id) }, sender: { $ne: userId }, read: false } },
    { $group: { _id: '$chat', count: { $sum: 1 } } },
  ])
  return new Map(counts.map(({ _id, count }) => [_id.toString(), count]))
}

function requireId(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, 'Invalid id')
}

export async function createChat(req, res) {
  const userId = req.body.userId || req.body.participantId
  requireId(userId)
  if (userId === req.user._id.toString()) throw httpError(400, 'You cannot chat with yourself')
  const otherUser = await User.findById(userId)
  if (!otherUser) throw httpError(404, 'User not found')
  let chat = await Chat.findOne({ participants: { $all: [req.user._id, userId] } }).populate('participants', '-passwordHash').populate('lastMessage')
  if (!chat) chat = await Chat.create({ participants: [req.user._id, userId] }).then(value => value.populate('participants', '-passwordHash'))
  res.status(201).json({ chat: chatView(chat) })
}

export async function listChats(req, res) {
  const chats = await Chat.find({ participants: req.user._id }).sort({ updatedAt: -1 }).populate('participants', '-passwordHash').populate('lastMessage')
  const unreadCounts = await unreadCountsFor(chats, req.user._id)
  res.json({ chats: chats.map(chat => chatView(chat, unreadCounts.get(chat._id.toString()) || 0)) })
}

export async function getChat(req, res) {
  requireId(req.params.id)
  const chat = await Chat.findOne({ _id: req.params.id, participants: req.user._id }).populate('participants', '-passwordHash').populate('lastMessage')
  if (!chat) throw httpError(404, 'Chat not found')
  const unreadCounts = await unreadCountsFor([chat], req.user._id)
  res.json({ chat: chatView(chat, unreadCounts.get(chat._id.toString()) || 0) })
}

export async function deleteChat(req, res) {
  requireId(req.params.id)
  const result = await Chat.deleteOne({ _id: req.params.id, participants: req.user._id })
  if (!result.deletedCount) throw httpError(404, 'Chat not found')
  res.status(204).end()
}
