import mongoose from 'mongoose'
import { z } from 'zod'
import Message from '../models/Message.js'
import Chat from '../models/Chat.js'
import { httpError } from '../middleware/errorMiddleware.js'
import { requireChatFriendship } from '../utils/friendships.js'
import { unreadMessageFilter } from '../utils/unreadMessages.js'
import { sendMessagePush } from '../utils/pushNotifications.js'
import { uploadMessageImage, deleteMessageImage, deleteVoiceNote } from '../config/cloudinary.js'
import { storeVoiceNote } from '../utils/voiceNotes.js'

const messageInput = z.object({ chatId: z.string(), text: z.string().trim().min(1).max(5000), replyTo: z.string().optional().nullable() })
const editInput = z.object({ text: z.string().trim().min(1).max(5000) })

export const messageView = message => {
  const readAt = message.readAt || (message.read ? message.updatedAt : null)
  const deliveredAt = message.deliveredAt || readAt
  return {
    id: message._id.toString(),
    chatId: message.chat?._id?.toString?.() || message.chat?.toString?.() || null,
    groupId: message.group?._id?.toString?.() || message.group?.toString?.() || null,
    conversationType: message.group ? 'group' : 'private',
    sender: message.sender.toPublicJSON(),
    text: message.deletedAt ? 'This message was deleted' : message.text,
    type: message.deletedAt ? 'text' : message.type || (message.audioUrl ? 'voice' : message.imageUrl ? 'image' : 'text'),
    imageUrl: message.deletedAt ? '' : message.imageUrl || '',
    audioUrl: message.deletedAt ? '' : message.audioUrl || '',
    duration: message.deletedAt ? 0 : Number(message.duration) || 0,
    deleted: Boolean(message.deletedAt),
    editedAt: message.editedAt,
    replyTo: message.replyTo ? {
      id: message.replyTo._id?.toString?.() || message.replyTo.toString(),
      text: message.replyTo.deletedAt ? 'This message was deleted' : message.replyTo.text,
      deleted: Boolean(message.replyTo.deletedAt),
      sender: message.replyTo.sender?.toPublicJSON?.() || null,
    } : null,
    story: message.story ? {
      id: message.story._id?.toString?.() || message.story.toString(),
      mediaType: message.story.mediaType,
      mediaUrl: message.story.deletedAt || message.story.expiresAt <= new Date() ? '' : message.story.mediaUrl,
      thumbnailUrl: message.story.deletedAt || message.story.expiresAt <= new Date() ? '' : message.story.mediaUrl,
      text: message.story.deletedAt || message.story.expiresAt <= new Date() ? '' : message.story.text,
      caption: message.story.deletedAt || message.story.expiresAt <= new Date() ? '' : message.story.caption,
      expired: Boolean(message.story.deletedAt || message.story.expiresAt <= new Date()),
      owner: message.story.user?.toProfileJSON?.() || null,
      expiresAt: message.story.expiresAt,
    } : null,
    read: Boolean(readAt),
    deliveredAt,
    readAt,
    status: readAt ? 'read' : deliveredAt ? 'delivered' : 'sent',
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  }
}

const messagePopulate = [
  { path: 'sender', select: '-passwordHash' },
  { path: 'replyTo', populate: { path: 'sender', select: '-passwordHash' } },
  { path: 'story', populate: { path: 'user', select: '-passwordHash' } },
]

function emitToMembers(req, chat, event, payload) {
  const io = req.app.get('io')
  chat.participants
    .filter(participant => participant.toString() !== req.user._id.toString())
    .forEach(participant => io?.to(`user:${participant.toString()}`).emit(event, payload))
}

async function memberChat(chatId, userId) {
  if (!mongoose.isValidObjectId(chatId)) throw httpError(400, 'Invalid chat id')
  const chat = await Chat.findOne({ _id: chatId, participants: userId })
  if (!chat) throw httpError(404, 'Chat not found')
  await requireChatFriendship(chat, userId)
  return chat
}

export async function getMessages(req, res) {
  const chat = await memberChat(req.params.chatId, req.user._id)
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1)
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), 100)
  const [messages, total] = await Promise.all([
    Message.find({ chat: chat._id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate(messagePopulate),
    Message.countDocuments({ chat: chat._id }),
  ])
  res.json({ messages: messages.reverse().map(messageView), page, limit, total, pages: Math.ceil(total / limit) })
}

export async function createMessage(req, res) {
  const input = messageInput.safeParse(req.body)
  if (!input.success) throw httpError(400, input.error.issues[0].message)
  const chat = await memberChat(input.data.chatId, req.user._id)
  let replyTo = null
  if (input.data.replyTo) {
    if (!mongoose.isValidObjectId(input.data.replyTo)) throw httpError(400, 'Invalid reply message')
    replyTo = await Message.findOne({ _id: input.data.replyTo, chat: chat._id })
    if (!replyTo) throw httpError(404, 'Reply message not found')
  }
  const message = await Message.create({ chat: chat._id, sender: req.user._id, text: input.data.text, replyTo: replyTo?._id || null })
  await Chat.findByIdAndUpdate(chat._id, { lastMessage: message._id })
  const populated = await message.populate(messagePopulate)
  const view = messageView(populated)
  emitToMembers(req, chat, 'message_received', { message: view })
  const recipientId = chat.participants.find(participant => participant.toString() !== req.user._id.toString())?.toString()
  if (recipientId) sendMessagePush(recipientId, { conversationId: chat._id.toString(), title: view.sender.username, text: view.text, messageId: view.id }).catch(() => {})
  res.status(201).json({ message: view })
}

export async function createImageMessage(req, res) {
  if (!req.file) throw httpError(400, 'Choose an image to send')
  const chat = await memberChat(req.params.chatId, req.user._id)
  const caption = String(req.body.caption || '').trim()
  if (caption.length > 5000) throw httpError(400, 'Caption must be 5000 characters or fewer')
  let replyTo = null
  if (req.body.replyTo) {
    if (!mongoose.isValidObjectId(req.body.replyTo)) throw httpError(400, 'Invalid reply message')
    replyTo = await Message.findOne({ _id: req.body.replyTo, chat: chat._id })
    if (!replyTo) throw httpError(404, 'Reply message not found')
  }

  const uploaded = await uploadMessageImage(req.file.buffer)
  let message
  try {
    message = await Message.create({
      chat: chat._id,
      sender: req.user._id,
      text: caption || 'Photo',
      type: 'image',
      imageUrl: uploaded.secure_url,
      imagePublicId: uploaded.public_id,
      replyTo: replyTo?._id || null,
    })
    await Chat.findByIdAndUpdate(chat._id, { lastMessage: message._id })
  } catch (error) {
    await deleteMessageImage(uploaded.public_id).catch(() => {})
    throw error
  }

  const view = messageView(await message.populate(messagePopulate))
  emitToMembers(req, chat, 'message_received', { message: view })
  const recipientId = chat.participants.find(participant => participant.toString() !== req.user._id.toString())?.toString()
  if (recipientId) sendMessagePush(recipientId, { conversationId: chat._id.toString(), title: view.sender.username, text: caption || 'Sent a photo', messageId: view.id }).catch(() => {})
  res.status(201).json({ message: view })
}

export async function createVoiceMessage(req, res) {
  const chat = await memberChat(req.params.chatId, req.user._id)
  let replyTo = null
  if (req.body.replyTo) {
    if (!mongoose.isValidObjectId(req.body.replyTo)) throw httpError(400, 'Invalid reply message')
    replyTo = await Message.findOne({ _id: req.body.replyTo, chat: chat._id })
    if (!replyTo) throw httpError(404, 'Reply message not found')
  }

  const stored = await storeVoiceNote(req.file)
  let message
  try {
    message = await Message.create({ chat: chat._id, sender: req.user._id, text: 'Voice message', type: 'voice', ...stored, replyTo: replyTo?._id || null })
    await Chat.findByIdAndUpdate(chat._id, { lastMessage: message._id })
  } catch (error) {
    await deleteVoiceNote(stored.audioPublicId).catch(() => {})
    throw error
  }

  const view = messageView(await message.populate(messagePopulate))
  emitToMembers(req, chat, 'message_received', { message: view })
  const recipientId = chat.participants.find(participant => participant.toString() !== req.user._id.toString())?.toString()
  if (recipientId) sendMessagePush(recipientId, { conversationId: chat._id.toString(), title: view.sender.username, text: 'Voice message', messageId: view.id }).catch(() => {})
  res.status(201).json({ message: view })
}

export async function editMessage(req, res) {
  const input = editInput.safeParse(req.body)
  if (!input.success) throw httpError(400, input.error.issues[0].message)
  const message = await Message.findOne({ _id: req.params.id, sender: req.user._id, deletedAt: null }).populate(messagePopulate)
  if (!message) throw httpError(404, 'Message not found')
  message.text = input.data.text
  message.editedAt = new Date()
  await message.save()
  await message.populate(messagePopulate)
  const chat = await memberChat(message.chat, req.user._id)
  const view = messageView(message)
  emitToMembers(req, chat, 'message_updated', { message: view })
  res.json({ message: view })
}

export async function markRead(req, res) {
  const message = await Message.findOne(unreadMessageFilter(req.user._id, { _id: req.params.id }))
  if (!message) throw httpError(404, 'Message not found')
  await memberChat(message.chat, req.user._id)
  message.readBy.addToSet(req.user._id)
  message.read = true
  message.deliveredAt ||= new Date()
  message.readAt = new Date()
  await message.save()
  res.json({ message: { id: message._id.toString(), read: true, deliveredAt: message.deliveredAt, readAt: message.readAt, status: 'read' } })
}

export async function deleteMessage(req, res) {
  const message = await Message.findOne({ _id: req.params.id, sender: req.user._id, deletedAt: null }).select('+imagePublicId +audioPublicId')
  if (!message) throw httpError(404, 'Message not found')
  const chat = await memberChat(message.chat, req.user._id)
  // Keep the required schema field valid while messageView hides the original content.
  message.text = 'This message was deleted'
  message.deletedAt = new Date()
  const imagePublicId = message.imagePublicId
  const audioPublicId = message.audioPublicId
  message.imageUrl = ''
  message.imagePublicId = ''
  message.audioUrl = ''
  message.audioPublicId = ''
  await message.save()
  await deleteMessageImage(imagePublicId).catch(() => {})
  await deleteVoiceNote(audioPublicId).catch(() => {})
  const populated = await message.populate(messagePopulate)
  emitToMembers(req, chat, 'message_deleted', { message: messageView(populated) })
  res.status(204).end()
}
