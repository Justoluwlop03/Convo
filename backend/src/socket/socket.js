import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import Chat from '../models/Chat.js'
import Group from '../models/Group.js'
import Message from '../models/Message.js'
import User from '../models/User.js'
import { messageView } from '../controllers/messageController.js'
import { areFriends } from '../utils/friendships.js'
import { unreadMessageFilter } from '../utils/unreadMessages.js'
import { sendMessagePush } from '../utils/pushNotifications.js'

const onlineSockets = new Map()
const activeCalls = new Map()
const callByUser = new Map()
const CALL_TIMEOUT_MS = 35_000
const roomFor = chatId => `chat:${chatId}`
const userRoomFor = userId => `user:${userId}`
const groupRoomFor = groupId => `group:${groupId}`

function isMember(chat, userId) {
  return chat?.participants.some(participant => participant.toString() === userId.toString())
}

async function canUseChat(chat, userId) {
  if (!isMember(chat, userId)) return false
  const otherUserId = chat.participants.find(participant => participant.toString() !== userId.toString())
  return Boolean(otherUserId && await areFriends(userId, otherUserId))
}

async function canUseGroup(groupId, userId) {
  return mongoose.isValidObjectId(groupId) && Boolean(await Group.exists({ _id: groupId, members: userId }))
}

function callParticipant(user) {
  return { id: user._id.toString(), username: user.username, avatar: user.avatar || '' }
}

function callForUser(userId) {
  const callId = callByUser.get(userId)
  return callId ? activeCalls.get(callId) : null
}

function clearCall(callId) {
  const call = activeCalls.get(callId)
  if (!call) return null
  clearTimeout(call.timeout)
  activeCalls.delete(callId)
  callByUser.delete(call.callerId)
  callByUser.delete(call.receiverId)
  return call
}

function validSignal(value) {
  return value && typeof value === 'object' && JSON.stringify(value).length <= 100_000
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

    socket.on('join_group', async ({ groupId } = {}, acknowledge) => {
      if (!(await canUseGroup(groupId, userId))) return acknowledge?.({ error: 'Group access denied' })
      socket.join(groupRoomFor(groupId))
      acknowledge?.({ ok: true })
    })

    socket.on('leave_chat', ({ chatId } = {}) => {
      socket.to(roomFor(chatId)).emit('typing_stopped', { userId, chatId })
      socket.leave(roomFor(chatId))
    })

    socket.on('leave_group', ({ groupId } = {}) => {
      socket.to(groupRoomFor(groupId)).emit('group_typing_stopped', { userId, groupId })
      socket.leave(groupRoomFor(groupId))
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
        if (recipientId) sendMessagePush(recipientId, { conversationId: chat._id.toString(), title: payload.sender.username, text: payload.text, messageId: payload.id }).catch(() => {})
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
    socket.on('group_typing', async ({ groupId } = {}) => {
      if (await canUseGroup(groupId, userId)) socket.to(groupRoomFor(groupId)).emit('group_typing_started', { userId, groupId })
    })
    socket.on('group_stop_typing', async ({ groupId } = {}) => {
      if (await canUseGroup(groupId, userId)) socket.to(groupRoomFor(groupId)).emit('group_typing_stopped', { userId, groupId })
    })

    socket.on('call:initiate', async ({ chatId } = {}, acknowledge) => {
      try {
        if (callForUser(userId)) throw new Error('You are already in a call')
        if (!mongoose.isValidObjectId(chatId)) throw new Error('Invalid conversation')
        const chat = await Chat.findById(chatId).populate('participants', '-passwordHash')
        if (!(await canUseChat(chat, userId))) throw new Error('You can only call accepted friends')
        const receiver = chat.participants.find(participant => participant._id.toString() !== userId)
        if (!receiver) throw new Error('Call recipient not found')
        if (callForUser(receiver._id.toString())) {
          acknowledge?.({ error: 'The recipient is busy' })
          return socket.emit('call:busy', { chatId })
        }
        if (!onlineSockets.get(receiver._id.toString())?.size) {
          acknowledge?.({ error: 'The recipient is offline' })
          return socket.emit('call:timeout', { chatId, reason: 'The recipient is offline' })
        }
        const callId = crypto.randomUUID()
        const call = { id: callId, chatId, callerId: userId, receiverId: receiver._id.toString(), status: 'ringing', timeout: null }
        call.timeout = setTimeout(() => {
          const expired = clearCall(callId)
          if (!expired || expired.status !== 'ringing') return
          io.to(userRoomFor(expired.callerId)).emit('call:timeout', { callId, reason: 'No answer' })
          io.to(userRoomFor(expired.receiverId)).emit('call:end', { callId, reason: 'missed' })
        }, CALL_TIMEOUT_MS)
        activeCalls.set(callId, call)
        callByUser.set(userId, callId)
        callByUser.set(receiver._id.toString(), callId)
        io.to(userRoomFor(receiver._id.toString())).emit('call:incoming', { callId, chatId, caller: callParticipant(socket.user) })
        acknowledge?.({ ok: true, callId })
      } catch (error) {
        acknowledge?.({ error: error.message })
      }
    })

    socket.on('call:accept', ({ callId } = {}, acknowledge) => {
      const call = activeCalls.get(callId)
      if (!call || call.receiverId !== userId || call.status !== 'ringing') return acknowledge?.({ error: 'This call is no longer available' })
      clearTimeout(call.timeout)
      call.status = 'accepted'
      call.timeout = setTimeout(() => {
        const expired = clearCall(callId)
        if (!expired) return
        io.to(userRoomFor(expired.callerId)).emit('call:timeout', { callId, reason: 'Unable to connect the call' })
        io.to(userRoomFor(expired.receiverId)).emit('call:timeout', { callId, reason: 'Unable to connect the call' })
      }, CALL_TIMEOUT_MS)
      io.to(userRoomFor(call.callerId)).emit('call:accept', { callId })
      acknowledge?.({ ok: true })
    })

    socket.on('call:reject', ({ callId } = {}, acknowledge) => {
      const call = activeCalls.get(callId)
      if (!call || call.receiverId !== userId) return acknowledge?.({ error: 'This call is no longer available' })
      clearCall(callId)
      io.to(userRoomFor(call.callerId)).emit('call:reject', { callId, reason: 'Call declined' })
      acknowledge?.({ ok: true })
    })

    socket.on('call:offer', ({ callId, offer } = {}, acknowledge) => {
      const call = activeCalls.get(callId)
      if (!call || call.callerId !== userId || call.status !== 'accepted' || !validSignal(offer)) return acknowledge?.({ error: 'Invalid call offer' })
      io.to(userRoomFor(call.receiverId)).emit('call:offer', { callId, offer })
      acknowledge?.({ ok: true })
    })

    socket.on('call:answer', ({ callId, answer } = {}, acknowledge) => {
      const call = activeCalls.get(callId)
      if (!call || call.receiverId !== userId || call.status !== 'accepted' || !validSignal(answer)) return acknowledge?.({ error: 'Invalid call answer' })
      clearTimeout(call.timeout)
      call.timeout = null
      call.status = 'connected'
      io.to(userRoomFor(call.callerId)).emit('call:answer', { callId, answer })
      acknowledge?.({ ok: true })
    })

    socket.on('call:ice-candidate', ({ callId, candidate } = {}, acknowledge) => {
      const call = activeCalls.get(callId)
      if (!call || ![call.callerId, call.receiverId].includes(userId) || !['accepted', 'connected'].includes(call.status) || !validSignal(candidate)) return acknowledge?.({ error: 'Invalid ICE candidate' })
      const recipientId = call.callerId === userId ? call.receiverId : call.callerId
      io.to(userRoomFor(recipientId)).emit('call:ice-candidate', { callId, candidate })
      acknowledge?.({ ok: true })
    })

    socket.on('call:end', ({ callId } = {}, acknowledge) => {
      const call = activeCalls.get(callId)
      if (!call || ![call.callerId, call.receiverId].includes(userId)) return acknowledge?.({ error: 'This call is no longer available' })
      clearCall(callId)
      const recipientId = call.callerId === userId ? call.receiverId : call.callerId
      io.to(userRoomFor(recipientId)).emit('call:end', { callId, reason: 'ended' })
      acknowledge?.({ ok: true })
    })

    socket.on('message_delivered', async ({ messageId, chatId } = {}) => {
      if (!mongoose.isValidObjectId(messageId) || !mongoose.isValidObjectId(chatId)) return
      const chat = await Chat.findOne({ _id: chatId, participants: userId })
      if (!chat) return
      const message = await Message.findOneAndUpdate(
        { _id: messageId, chat: chat._id, sender: { $ne: userId } },
        { $set: { deliveredAt: new Date() } },
        { returnDocument: 'after' },
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
      const group = chat ? null : await Group.findOne({ _id: chatId, members: userId })
      if (!chat && !group) return
      const conversation = chat ? { chat: chat._id } : { group: group._id }
      const messages = await Message.find(unreadMessageFilter(userId, conversation)).select('_id sender')
      if (!messages.length) return
      const readAt = new Date()
      const messageIds = messages.map(message => message._id)
      await Message.updateMany({ _id: { $in: messageIds } }, { $set: { read: true, deliveredAt: readAt, readAt }, $addToSet: { readBy: userId } })
      io.to(userRoomFor(userId)).emit('conversation_read', { chatId: chatId.toString() })
      const senderIds = [...new Set(messages.map(message => message.sender.toString()))]
      senderIds.forEach(senderId => io.to(userRoomFor(senderId)).emit('messages_read', {
        chatId: chatId.toString(),
        messageIds: messageIds.map(id => id.toString()),
        readAt,
      }))
    })

    socket.on('disconnect', async () => {
      const activeSockets = onlineSockets.get(userId)
      activeSockets?.delete(socket.id)
      if (activeSockets?.size) return
      onlineSockets.delete(userId)
      const activeCall = callForUser(userId)
      if (activeCall) {
        clearCall(activeCall.id)
        const recipientId = activeCall.callerId === userId ? activeCall.receiverId : activeCall.callerId
        io.to(userRoomFor(recipientId)).emit('call:end', { callId: activeCall.id, reason: 'The other caller disconnected' })
      }
      const lastSeen = new Date()
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen })
      socket.broadcast.emit('user_offline', { userId, lastSeen })
    })
  })
}
