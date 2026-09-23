import mongoose from 'mongoose'
import { z } from 'zod'
import Chat from '../models/Chat.js'
import Message from '../models/Message.js'
import Story from '../models/Story.js'
import StoryView from '../models/StoryView.js'
import { deleteStoryMedia, uploadStoryMedia } from '../config/cloudinary.js'
import { httpError } from '../middleware/errorMiddleware.js'
import { areFriends, requireChatFriendship } from '../utils/friendships.js'
import { sendMessagePush } from '../utils/pushNotifications.js'
import { messageView } from './messageController.js'

const statusInput = z.object({
  mediaType: z.enum(['image', 'video', 'text']).optional(),
  text: z.string().trim().max(1000).optional().default(''),
  caption: z.string().trim().max(280).optional().default(''),
  visibility: z.enum(['friends', 'public']).optional().default('friends'),
})
const replyInput = z.object({ text: z.string().trim().min(1).max(5000) })
const reactionInput = z.object({ emoji: z.enum(['❤️', '😂', '😮', '😢', '🔥', '👍']) })
const activeFilter = () => ({ expiresAt: { $gt: new Date() }, deletedAt: null })

function thumbnail(url = '', mediaType) {
  if (!url || !url.includes('/upload/')) return url
  const transform = mediaType === 'video' ? 'so_0,c_fill,w_360,h_540,q_auto,f_jpg' : 'c_fill,w_360,h_540,q_auto,f_auto'
  return url.replace('/upload/', `/upload/${transform}/`)
}

function elapsed(createdAt) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`
}

async function accessibleStory(storyId, viewerId) {
  if (!mongoose.isValidObjectId(storyId)) throw httpError(404, 'Status unavailable')
  const story = await Story.findOne({ _id: storyId, ...activeFilter() }).populate('user', '-passwordHash').select('+mediaPublicId')
  if (!story) throw httpError(404, 'Status unavailable or expired')
  const own = story.user._id.toString() === viewerId.toString()
  const friends = own || await areFriends(viewerId, story.user._id)
  if (!own && story.visibility !== 'public' && !friends) throw httpError(403, 'You cannot view this status')
  story.canReply = !own && friends
  return story
}

function asView(story, viewerId, { full = false, viewedIds = new Set(), viewCounts = new Map() } = {}) {
  const own = story.user._id.toString() === viewerId.toString()
  return {
    id: story._id.toString(), user: story.user.toProfileJSON(), mediaType: story.mediaType,
    mediaUrl: full ? story.mediaUrl : undefined, thumbnailUrl: thumbnail(story.mediaUrl, story.mediaType),
    text: story.text, caption: story.caption, createdAt: story.createdAt, expiresAt: story.expiresAt,
    timeAgo: elapsed(story.createdAt), visibility: story.visibility, isOwner: own,
    viewed: own || viewedIds.has(story._id.toString()),
    viewCount: own ? (viewCounts.get(story._id.toString()) || 0) : undefined,
    canReply: Boolean(story.canReply),
    reactions: own ? story.reactions.map(item => ({ emoji: item.emoji, userId: item.user.toString() })) : [],
  }
}

async function viewData(stories, userId) {
  const ids = stories.map(story => story._id)
  if (!ids.length) return { viewedIds: new Set(), viewCounts: new Map() }
  const [viewed, counts] = await Promise.all([
    StoryView.find({ story: { $in: ids }, viewer: userId }).select('story').lean(),
    StoryView.aggregate([{ $match: { story: { $in: ids } } }, { $group: { _id: '$story', count: { $sum: 1 } } }]),
  ])
  return { viewedIds: new Set(viewed.map(view => view.story.toString())), viewCounts: new Map(counts.map(item => [item._id.toString(), item.count])) }
}

export async function createStory(req, res) {
  const parsed = statusInput.safeParse(req.body || {})
  if (!parsed.success) throw httpError(400, parsed.error.issues[0].message)
  const mediaType = req.file ? (req.file.mimetype.startsWith('video/') ? 'video' : 'image') : (parsed.data.mediaType || 'text')
  if (mediaType !== 'text' && !req.file) throw httpError(400, 'Choose an image or video to post')
  if (mediaType === 'text' && !parsed.data.text.trim()) throw httpError(400, 'Write something for your status')

  let uploaded = null
  if (req.file) {
    uploaded = await uploadStoryMedia(req.file.buffer, mediaType)
    if (mediaType === 'video' && Number(uploaded.duration) > 60) {
      await deleteStoryMedia(uploaded.public_id, mediaType).catch(() => {})
      throw httpError(400, 'Videos must be 60 seconds or shorter')
    }
  }
  const story = await Story.create({
    user: req.user._id, mediaType, mediaUrl: uploaded?.secure_url || '', mediaPublicId: uploaded?.public_id || '',
    text: mediaType === 'text' ? parsed.data.text.trim() : '', caption: parsed.data.caption,
    visibility: parsed.data.visibility, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
  await story.populate('user', '-passwordHash')
  const io = req.app.get('io')
  req.user.friends.forEach(friend => io?.to(`user:${friend}`).emit('story_created', { userId: req.user._id.toString() }))
  io?.to(`user:${req.user._id}`).emit('story_created', { userId: req.user._id.toString() })
  if (story.visibility === 'public') io?.emit('story_created', { userId: req.user._id.toString() })
  res.status(201).json({ story: asView(story, req.user._id) })
}

export async function listStories(req, res) {
  const audience = [req.user._id, ...req.user.friends]
  const stories = await Story.find({ ...activeFilter(), $or: [{ user: { $in: audience } }, { visibility: 'public' }] })
    .sort({ createdAt: -1 }).limit(500).populate('user', '-passwordHash')
  const { viewedIds, viewCounts } = await viewData(stories, req.user._id)
  const grouped = new Map()
  stories.forEach(story => {
    const view = asView(story, req.user._id, { viewedIds, viewCounts })
    const group = grouped.get(view.user.id) || { user: view.user, stories: [], hasUnviewed: false, latestAt: story.createdAt }
    group.stories.unshift(view)
    group.hasUnviewed ||= !view.viewed
    if (new Date(story.createdAt) > new Date(group.latestAt)) group.latestAt = story.createdAt
    grouped.set(view.user.id, group)
  })
  const groups = [...grouped.values()]
  groups.forEach(group => group.stories.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)))
  groups.sort((a, b) => Number(b.user.id === req.user._id.toString()) - Number(a.user.id === req.user._id.toString()) || Number(b.hasUnviewed) - Number(a.hasUnviewed) || new Date(b.latestAt) - new Date(a.latestAt))
  res.json({ stories: groups })
}

export async function listUserStories(req, res) {
  if (!mongoose.isValidObjectId(req.params.userId)) throw httpError(404, 'User not found')
  const isFriend = await areFriends(req.user._id, req.params.userId)
  const stories = await Story.find({ user: req.params.userId, ...activeFilter(), $or: [{ visibility: 'public' }, ...(isFriend || req.params.userId === req.user._id.toString() ? [{ visibility: 'friends' }] : [])] })
    .sort({ createdAt: 1 }).populate('user', '-passwordHash')
  const { viewedIds, viewCounts } = await viewData(stories, req.user._id)
  res.json({ stories: stories.map(story => asView(story, req.user._id, { viewedIds, viewCounts })) })
}

export async function getStory(req, res) {
  const story = await accessibleStory(req.params.storyId, req.user._id)
  const { viewedIds, viewCounts } = await viewData([story], req.user._id)
  res.json({ story: asView(story, req.user._id, { full: true, viewedIds, viewCounts }) })
}

export async function deleteStory(req, res) {
  if (!mongoose.isValidObjectId(req.params.storyId)) throw httpError(404, 'Status not found')
  const story = await Story.findOne({ _id: req.params.storyId, user: req.user._id, ...activeFilter() }).select('+mediaPublicId')
  if (!story) throw httpError(404, 'Status not found')
  story.deletedAt = new Date()
  await story.save()
  await deleteStoryMedia(story.mediaPublicId, story.mediaType).catch(() => {})
  const audience = new Set([...req.user.friends.map(id => id.toString()), req.user._id.toString()])
  audience.forEach(userId => req.app.get('io')?.to(`user:${userId}`).emit('story_deleted', { storyId: story.id }))
  res.status(204).end()
}

export async function recordStoryView(req, res) {
  const story = await accessibleStory(req.params.storyId, req.user._id)
  if (story.user._id.toString() !== req.user._id.toString()) {
    try {
      const result = await StoryView.updateOne({ story: story._id, viewer: req.user._id }, { $setOnInsert: { viewedAt: new Date() } }, { upsert: true })
      if (result.upsertedCount) req.app.get('io')?.to(`user:${story.user._id}`).emit('story_interaction', { storyId: story.id, type: 'view' })
    } catch (error) { if (error.code !== 11000) throw error }
  }
  res.status(204).end()
}

export async function listStoryViews(req, res) {
  if (!mongoose.isValidObjectId(req.params.storyId)) throw httpError(404, 'Status not found')
  const story = await Story.findOne({ _id: req.params.storyId, user: req.user._id, ...activeFilter() })
  if (!story) throw httpError(404, 'Status not found')
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 30))
  const [views, total] = await Promise.all([
    StoryView.find({ story: story._id }).sort({ viewedAt: -1 }).skip((page - 1) * limit).limit(limit).populate('viewer', '-passwordHash').lean(),
    StoryView.countDocuments({ story: story._id }),
  ])
  const reactions = new Map(story.reactions.map(item => [item.user.toString(), item.emoji]))
  res.json({ viewers: views.filter(view => view.viewer).map(view => ({
    user: { id: view.viewer._id.toString(), username: view.viewer.username, avatar: view.viewer.avatar, bio: view.viewer.bio },
    viewedAt: view.viewedAt, reaction: reactions.get(view.viewer._id.toString()) || null,
  })), page, hasMore: page * limit < total })
}

export async function reactToStory(req, res) {
  const parsed = reactionInput.safeParse(req.body)
  if (!parsed.success) throw httpError(400, 'Choose a valid reaction')
  const story = await accessibleStory(req.params.storyId, req.user._id)
  if (story.user._id.toString() === req.user._id.toString()) throw httpError(400, 'You cannot react to your own status')
  story.reactions = story.reactions.filter(item => item.user.toString() !== req.user._id.toString())
  story.reactions.push({ user: req.user._id, emoji: parsed.data.emoji })
  await story.save()
  req.app.get('io')?.to(`user:${story.user._id}`).emit('story_interaction', { storyId: story.id, type: 'reaction' })
  res.json({ reactions: story.reactions.map(item => ({ emoji: item.emoji, userId: item.user.toString() })) })
}

export async function replyToStory(req, res) {
  const parsed = replyInput.safeParse(req.body)
  if (!parsed.success) throw httpError(400, parsed.error.issues[0].message)
  const story = await accessibleStory(req.params.storyId, req.user._id)
  if (story.user._id.toString() === req.user._id.toString()) throw httpError(400, 'You cannot reply to your own status')
  await requireChatFriendship({ participants: [req.user._id, story.user._id] }, req.user._id)
  let chat = await Chat.findOne({ participants: { $all: [req.user._id, story.user._id] } })
  if (!chat) chat = await Chat.create({ participants: [req.user._id, story.user._id] })
  const message = await Message.create({ chat: chat._id, sender: req.user._id, text: parsed.data.text, story: story._id })
  await Chat.findByIdAndUpdate(chat._id, { lastMessage: message._id, updatedAt: new Date() })
  await message.populate([{ path: 'sender', select: '-passwordHash' }, { path: 'story', populate: { path: 'user', select: '-passwordHash' } }])
  const view = messageView(message)
  const io = req.app.get('io')
  io?.to(`user:${story.user._id}`).emit('message_received', { message: view })
  io?.to(`user:${req.user._id}`).emit('message_received', { message: view })
  io?.to(`user:${story.user._id}`).emit('story_interaction', { storyId: story.id, type: 'reply' })
  sendMessagePush(story.user._id.toString(), { conversationId: chat._id.toString(), title: req.user.username, text: `Replied to your status: ${parsed.data.text}`, messageId: message._id.toString() }).catch(() => {})
  res.status(201).json({ message: view, chatId: chat._id.toString() })
}
