import mongoose from 'mongoose'
import Chat from '../models/Chat.js'
import User from '../models/User.js'
import Message from '../models/Message.js'
import { httpError } from '../middleware/errorMiddleware.js'
import { requireChatFriendship, requireFriends } from '../utils/friendships.js'
import { unreadMessageFilter } from '../utils/unreadMessages.js'
import { unreadTotalFor } from '../utils/unreadTotal.js'

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
    { $match: unreadMessageFilter(userId, { chat: { $in: chats.map(chat => chat._id) } }) },
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
  await requireFriends(req.user._id, otherUser._id)
  let chat = await Chat.findOne({ participants: { $all: [req.user._id, userId] } }).populate('participants', '-passwordHash').populate('lastMessage')
  if (!chat) chat = await Chat.create({ participants: [req.user._id, userId] }).then(value => value.populate('participants', '-passwordHash'))
  res.status(201).json({ chat: chatView(chat) })
}

export async function listChats(req, res) {
  const chats = await Chat.find({ participants: req.user._id }).sort({ updatedAt: -1 }).populate('participants', '-passwordHash').populate('lastMessage')
  const friendIds = new Set(req.user.friends.map(friend => friend.toString()))
  const friendChats = chats.filter(chat => chat.participants.some(participant => participant._id.toString() !== req.user._id.toString() && friendIds.has(participant._id.toString())))
  const unreadCounts = await unreadCountsFor(friendChats, req.user._id)
  res.json({ chats: friendChats.map(chat => chatView(chat, unreadCounts.get(chat._id.toString()) || 0)) })
}

export async function getChat(req, res) {
  requireId(req.params.id)
  const chat = await Chat.findOne({ _id: req.params.id, participants: req.user._id }).populate('participants', '-passwordHash').populate('lastMessage')
  if (!chat) throw httpError(404, 'Chat not found')
  await requireChatFriendship(chat, req.user._id)
  const unreadCounts = await unreadCountsFor([chat], req.user._id)
  res.json({ chat: chatView(chat, unreadCounts.get(chat._id.toString()) || 0) })
}

export async function unreadCount(req, res) {
  res.json({ unreadCount: await unreadTotalFor(req.user._id) })
}

export async function deleteChat(req, res) {
  requireId(req.params.id)
  const result = await Chat.deleteOne({ _id: req.params.id, participants: req.user._id })
  if (!result.deletedCount) throw httpError(404, 'Chat not found')
  res.status(204).end()
}
