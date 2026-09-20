import mongoose from 'mongoose'
import Chat from '../models/Chat.js'
import User from '../models/User.js'
import { httpError } from '../middleware/errorMiddleware.js'

const chatView = chat => ({
  id: chat._id.toString(),
  participants: chat.participants.map(participant => participant.toPublicJSON()),
  lastMessage: chat.lastMessage,
  createdAt: chat.createdAt,
  updatedAt: chat.updatedAt,
})

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
  res.json({ chats: chats.map(chatView) })
}

export async function getChat(req, res) {
  requireId(req.params.id)
  const chat = await Chat.findOne({ _id: req.params.id, participants: req.user._id }).populate('participants', '-passwordHash').populate('lastMessage')
  if (!chat) throw httpError(404, 'Chat not found')
  res.json({ chat: chatView(chat) })
}

export async function deleteChat(req, res) {
  requireId(req.params.id)
  const result = await Chat.deleteOne({ _id: req.params.id, participants: req.user._id })
  if (!result.deletedCount) throw httpError(404, 'Chat not found')
  res.status(204).end()
}
