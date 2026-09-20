import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import Chat from '../models/Chat.js'
import Message from '../models/Message.js'
import User from '../models/User.js'
import { messageView } from '../controllers/messageController.js'
import { areFriends } from '../utils/friendships.js'

const onlineSockets = new Map()
const roomFor = chatId => `chat:${chatId}`
const userRoomFor = userId => `user:${userId}`

function isMember(chat, userId) {
  return chat?.participants.some(participant => participant.toString() === userId.toString())
}

async function canUseChat(chat, userId) {
  if (!isMember(chat, userId)) return false
  const otherUserId = chat.participants.find(participant => participant.toString() !== userId.toString())
  return Boolean(otherUserId && await areFriends(userId, otherUserId))
}

export function configureSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token?.replace(/^Bearer /, '')
      const payload = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(payload.userId)
      if (!user) return next(new Error('Authentication required'))
      socket.user = user
      next()
    } catch {
      next(new Error('Authentication required'))
    }
  })

  io.on('connection', async socket => {
    const userId = socket.user._id.toString()
    const sockets = onlineSockets.get(userId) || new Set()
    sockets.add(socket.id)
    onlineSockets.set(userId, sockets)
    socket.join(userRoomFor(userId))
    await User.findByIdAndUpdate(userId, { isOnline: true })
    socket.broadcast.emit('user_online', { userId })

    socket.on('join_chat', async ({ chatId } = {}, acknowledge) => {
      if (!mongoose.isValidObjectId(chatId)) return acknowledge?.({ error: 'Invalid chat id' })
      const chat = await Chat.findById(chatId)
      if (!(await canUseChat(chat, userId))) return acknowledge?.({ error: 'Chat access denied' })
      socket.join(roomFor(chatId))
      acknowledge?.({ ok: true })
    })

    socket.on('leave_chat', ({ chatId } = {}) => {
      socket.to(roomFor(chatId)).emit('typing_stopped', { userId, chatId })
      socket.leave(roomFor(chatId))
    })

    socket.on('send_message', async ({ chatId, text, replyTo } = {}, acknowledge) => {
      try {
        const cleanText = String(text || '').trim()
        const chat = mongoose.isValidObjectId(chatId) ? await Chat.findById(chatId) : null
        if (!(await canUseChat(chat, userId))) throw new Error('You can only chat with accepted friends')
        if (!cleanText || cleanText.length > 5000) throw new Error('Message text is invalid')
        let replyMessage = null
        if (replyTo) {
          if (!mongoose.isValidObjectId(replyTo)) throw new Error('Invalid reply message')
          replyMessage = await Message.findOne({ _id: replyTo, chat: chat._id })
          if (!replyMessage) throw new Error('Reply message not found')
        }
        const message = await Message.create({ chat: chat._id, sender: userId, text: cleanText, replyTo: replyMessage?._id || null })
        await Chat.findByIdAndUpdate(chat._id, { lastMessage: message._id, updatedAt: new Date() })
        const populated = await message.populate([
          { path: 'sender', select: '-passwordHash' },
          { path: 'replyTo', populate: { path: 'sender', select: '-passwordHash' } },
        ])
        const payload = messageView(populated)
        const recipientId = chat.participants.find(participant => participant.toString() !== userId)?.toString()
        if (recipientId) io.to(userRoomFor(recipientId)).emit('message_received', { message: payload })
        acknowledge?.({ ok: true, message: payload })
      } catch (error) {
        acknowledge?.({ error: error.message })
        socket.emit('error', { message: error.message })
      }
    })

    socket.on('typing', async ({ chatId } = {}) => {
      const chat = mongoose.isValidObjectId(chatId) ? await Chat.findById(chatId) : null
      if (await canUseChat(chat, userId)) socket.to(roomFor(chatId)).emit('typing_started', { userId, chatId })
    })
    socket.on('stop_typing', async ({ chatId } = {}) => {
      const chat = mongoose.isValidObjectId(chatId) ? await Chat.findById(chatId) : null
      if (await canUseChat(chat, userId)) socket.to(roomFor(chatId)).emit('typing_stopped', { userId, chatId })
    })

    socket.on('message_delivered', async ({ messageId, chatId } = {}) => {
      if (!mongoose.isValidObjectId(messageId) || !mongoose.isValidObjectId(chatId)) return
      const chat = await Chat.findOne({ _id: chatId, participants: userId })
      if (!chat) return
      const message = await Message.findOneAndUpdate(
        { _id: messageId, chat: chat._id, sender: { $ne: userId } },
        { $set: { deliveredAt: new Date() } },
        { new: true },
      )
      if (!message) return
      io.to(userRoomFor(message.sender.toString())).emit('message_status', {
        chatId: chat._id.toString(),
        messageId: message._id.toString(),
        status: message.readAt || message.read ? 'read' : 'delivered',
        deliveredAt: message.deliveredAt,
        readAt: message.readAt,
      })
    })

    socket.on('messages_read', async ({ chatId } = {}) => {
      if (!mongoose.isValidObjectId(chatId)) return
      const chat = await Chat.findOne({ _id: chatId, participants: userId })
      if (!chat) return
      const messages = await Message.find({ chat: chat._id, sender: { $ne: userId }, readAt: null }).select('_id')
      if (!messages.length) return
      const readAt = new Date()
      const messageIds = messages.map(message => message._id)
      await Message.updateMany({ _id: { $in: messageIds } }, { $set: { read: true, deliveredAt: readAt, readAt } })
      const senderId = chat.participants.find(participant => participant.toString() !== userId)?.toString()
      if (senderId) io.to(userRoomFor(senderId)).emit('messages_read', {
        chatId: chat._id.toString(),
        messageIds: messageIds.map(id => id.toString()),
        readAt,
      })
    })

    socket.on('disconnect', async () => {
      const activeSockets = onlineSockets.get(userId)
      activeSockets?.delete(socket.id)
      if (activeSockets?.size) return
      onlineSockets.delete(userId)
      const lastSeen = new Date()
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen })
      socket.broadcast.emit('user_offline', { userId, lastSeen })
    })
  })
}
