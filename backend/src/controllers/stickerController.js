import User from '../models/User.js'
import Chat from '../models/Chat.js'
import Group from '../models/Group.js'
import Message from '../models/Message.js'
import { httpError } from '../middleware/errorMiddleware.js'
import { stickerPacks, stickers } from '../utils/stickers.js'
import { messageView } from './messageController.js'
import { sendMessagePush } from '../utils/pushNotifications.js'
import { requireChatFriendship } from '../utils/friendships.js'
import Sticker from '../models/Sticker.js'
import { uploadStickerImage, deleteMessageImage } from '../config/cloudinary.js'

async function customStickerForUser(stickerId, userId) {
  if (!/^[a-f\d]{24}$/i.test(stickerId)) return null
  const sticker = await Sticker.findById(stickerId)
  if (!sticker) return null
  if (sticker.owner.toString() === userId.toString()) return sticker
  const [chatIds, groupIds] = await Promise.all([
    Chat.find({ participants: userId }).distinct('_id'),
    Group.find({ members: userId }).distinct('_id'),
  ])
  const seen = await Message.exists({ type: 'sticker', stickerId, $or: [{ chat: { $in: chatIds } }, { group: { $in: groupIds } }] })
  return seen ? sticker : null
}

export async function getStickerData(req, res) {
  const user = await User.findById(req.user._id).select('favoriteStickers recentStickers')
  const custom = await Sticker.find({ $or: [{ owner: req.user._id }, { _id: { $in: [...user.favoriteStickers, ...user.recentStickers].filter(id => /^[a-f\d]{24}$/i.test(id)) } }] }).sort({ createdAt: -1 }).limit(120)
  const customStickers = custom.map(item => ({ id: item._id.toString(), url: item.url }))
  const packs = customStickers.length ? [...stickerPacks, { id: 'my-stickers', name: 'My stickers', cover: customStickers[0].url, stickers: customStickers.map(item => item.id) }] : stickerPacks
  res.json({ packs, customStickers, favorites: user.favoriteStickers, recent: user.recentStickers })
}

export async function setStickerFavorite(req, res) {
  const sticker = stickers[req.params.stickerId]
  const custom = sticker ? null : await customStickerForUser(req.params.stickerId, req.user._id)
  if (!sticker && !custom) throw httpError(404, 'Sticker not found')
  const stickerId = sticker?.id || custom._id.toString()
  const favorite = req.body?.favorite === true
  const update = favorite
    ? { $addToSet: { favoriteStickers: stickerId } }
    : { $pull: { favoriteStickers: stickerId } }
  const user = await User.findByIdAndUpdate(req.user._id, update, { new: true }).select('favoriteStickers')
  res.json({ favorites: user.favoriteStickers })
}

export async function useSticker(req, res) {
  const sticker = stickers[req.params.stickerId]
  const custom = sticker ? null : await customStickerForUser(req.params.stickerId, req.user._id)
  if (!sticker && !custom) throw httpError(404, 'Sticker not found')
  const stickerId = sticker?.id || custom._id.toString()
  const user = await User.findByIdAndUpdate(req.user._id, { $pull: { recentStickers: stickerId } }, { new: true }).select('recentStickers')
  user.set('recentStickers', [stickerId, ...user.recentStickers].slice(0, 20))
  await user.save()
  res.json({ recent: user.recentStickers })
}

export async function sendSticker(req, res) {
  const sticker = stickers[req.body?.stickerId]
  const custom = sticker ? null : await customStickerForUser(req.body?.stickerId || '', req.user._id)
  if (!sticker && !custom) throw httpError(400, 'Choose a sticker from your Convo collection')
  const stickerId = sticker?.id || custom._id.toString()
  const stickerUrl = sticker?.url || custom.url
  let chat = null
  let group = null
  if (req.body?.groupId) {
    group = await Group.findOne({ _id: req.body.groupId, members: req.user._id }).populate('members', '-passwordHash')
    if (!group) throw httpError(404, 'Group not found')
    if (group.locked && !group.admins.some(id => id.toString() === req.user._id.toString())) throw httpError(403, 'This group is locked. Only admins can send messages.')
  } else {
    if (!req.body?.chatId || !/^[a-f\d]{24}$/i.test(req.body.chatId)) throw httpError(400, 'Invalid chat id')
    chat = await Chat.findOne({ _id: req.body?.chatId, participants: req.user._id })
    if (!chat) throw httpError(404, 'Chat not found')
    await requireChatFriendship(chat, req.user._id)
  }
  const message = await Message.create({ ...(chat ? { chat: chat._id } : { group: group._id }), sender: req.user._id, text: 'Sticker', type: 'sticker', stickerId, stickerUrl })
  try {
    const user = await User.findByIdAndUpdate(req.user._id, { $pull: { recentStickers: stickerId } }, { new: true }).select('recentStickers')
    user.set('recentStickers', [stickerId, ...user.recentStickers].slice(0, 20))
    await user.save()
  } catch (error) { console.error('Unable to save recent sticker:', error.message) }
  if (chat) await Chat.findByIdAndUpdate(chat._id, { lastMessage: message._id, updatedAt: new Date() })
  else await Group.findByIdAndUpdate(group._id, { lastMessage: message._id, updatedAt: new Date() })
  const view = messageView(await message.populate([{ path: 'sender', select: '-passwordHash' }]))
  const io = req.app.get('io')
  if (chat) {
    const recipient = chat.participants.find(id => id.toString() !== req.user._id.toString())
    io?.to(`user:${recipient}`).emit('message_received', { message: view })
    sendMessagePush(recipient.toString(), { conversationId: chat._id.toString(), title: view.sender.username, text: 'Sent a sticker', messageId: view.id }).catch(() => {})
  } else {
    await Promise.all(group.members.filter(member => member._id.toString() !== req.user._id.toString()).map(async member => {
      io?.to(`user:${member._id}`).emit('group_message_received', { message: view })
      sendMessagePush(member._id.toString(), { conversationId: group._id.toString(), title: group.name, text: 'Sent a sticker', messageId: view.id }).catch(() => {})
    }))
  }
  res.status(201).json({ message: view })
}

export async function createCustomSticker(req, res) {
  if (!req.file) throw httpError(400, 'Choose an image to turn into a sticker')
  if (!['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].every(key => process.env[key])) {
    throw httpError(503, 'Adding custom stickers requires Cloudinary to be configured by the app administrator')
  }
  let uploaded
  try {
    uploaded = await uploadStickerImage(req.file.buffer)
    const sticker = await Sticker.create({ owner: req.user._id, url: uploaded.secure_url, publicId: uploaded.public_id })
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { favoriteStickers: sticker._id.toString() } })
    res.status(201).json({ sticker: { id: sticker._id.toString(), url: sticker.url } })
  } catch (error) {
    if (uploaded?.public_id) await deleteMessageImage(uploaded.public_id).catch(() => {})
    throw error
  }
}
