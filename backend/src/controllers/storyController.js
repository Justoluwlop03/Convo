import mongoose from 'mongoose'
import { z } from 'zod'
import Chat from '../models/Chat.js'
import Message from '../models/Message.js'
import Story from '../models/Story.js'
import StoryView from '../models/StoryView.js'
import User from '../models/User.js'
import { deleteStoryMedia, uploadStoryMedia } from '../config/cloudinary.js'
import { httpError } from '../middleware/errorMiddleware.js'
import { areFriends } from '../utils/friendships.js'
import { messageView } from './messageController.js'

const storyInput = z.object({ caption: z.string().trim().max(280).optional().default(''), visibility: z.enum(['friends', 'public']).optional().default('friends') })
const replyInput = z.object({ text: z.string().trim().min(1).max(5000) })
const reactionInput = z.object({ emoji: z.enum(['❤️', '😂', '😮', '😢', '👍']) })
const activeFilter = () => ({ expiresAt: { $gt: new Date() } })

function thumbnail(url, mediaType) {
  if (!url.includes('/upload/')) return url
  const transform = mediaType === 'video' ? 'so_0,c_fill,w_160,h_160,q_auto,f_jpg' : 'c_fill,w_160,h_160,q_auto,f_auto'
  return url.replace('/upload/', `/upload/${transform}/`)
}

function elapsed(createdAt) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000))
  return minutes < 60 ? `${minutes || 1}m` : `${Math.floor(minutes / 60)}h`
}

async function accessibleStory(storyId, viewerId, includePrivate = false) {
  if (!mongoose.isValidObjectId(storyId)) throw httpError(404, 'Story unavailable')
  const story = await Story.findOne({ _id: storyId, ...activeFilter() }).populate('user', '-passwordHash').select(includePrivate ? '+mediaPublicId' : '')
  if (!story) throw httpError(404, 'Story unavailable or expired')
  if (story.user._id.toString() !== viewerId.toString() && story.visibility !== 'public' && !(await areFriends(viewerId, story.user._id))) throw httpError(403, 'You cannot view this story')
  return story
}

async function storyView(story, viewerId, { full = false } = {}) {
  const own = story.user._id.toString() === viewerId.toString()
  const [viewed, viewCount] = await Promise.all([
    own ? false : StoryView.exists({ story: story._id, viewer: viewerId }),
    own ? StoryView.countDocuments({ story: story._id }) : 0,
  ])
  return {
    id: story._id.toString(), user: story.user.toProfileJSON(), mediaType: story.mediaType,
    mediaUrl: full ? story.mediaUrl : undefined, thumbnailUrl: thumbnail(story.mediaUrl, story.mediaType), caption: story.caption,
    createdAt: story.createdAt, expiresAt: story.expiresAt, timeAgo: elapsed(story.createdAt), visibility: story.visibility, isOwner: own, viewed: Boolean(viewed), viewCount,
    reactions: story.reactions.map(reaction => ({ emoji: reaction.emoji, userId: reaction.user.toString() })),
  }
}

export async function createStory(req, res) {
  const input = storyInput.safeParse(req.body || {})
  if (!input.success) throw httpError(400, input.error.issues[0].message)
  if (!req.file) throw httpError(400, 'Choose an image or short video for your story')
  const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image'
  const uploaded = await uploadStoryMedia(req.file.buffer, mediaType)
  if (mediaType === 'video' && Number(uploaded.duration) > 60) {
    await deleteStoryMedia(uploaded.public_id, mediaType).catch(() => {})
    throw httpError(400, 'Story videos must be 60 seconds or shorter')
  }
  const story = await Story.create({ user: req.user._id, mediaUrl: uploaded.secure_url, mediaPublicId: uploaded.public_id, mediaType, caption: input.data.caption, visibility: input.data.visibility, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })
  await story.populate('user', '-passwordHash')
  const view = await storyView(story, req.user._id)
  const audience = [...new Set(req.user.friends.map(friend => friend.toString()))]
  audience.forEach(userId => req.app.get('io')?.to(`user:${userId}`).emit('story_created', { userId: req.user._id.toString() }))
  res.status(201).json({ story: view })
}

export async function listStories(req, res) {
  const audience = [req.user._id, ...req.user.friends]
  const stories = await Story.find({ ...activeFilter(), $or: [{ user: { $in: audience } }, { visibility: 'public' }] }).sort({ createdAt: 1 }).populate('user', '-passwordHash')
  const views = await Promise.all(stories.map(story => storyView(story, req.user._id)))
  const byUser = new Map()
  views.forEach(story => { const group = byUser.get(story.user.id) || { user: story.user, stories: [] }; group.stories.push(story); byUser.set(story.user.id, group) })
  res.json({ stories: [...byUser.values()].sort((a, b) => Number(b.user.id === req.user._id.toString()) - Number(a.user.id === req.user._id.toString())) })
}

export async function getStory(req, res) {
  const story = await accessibleStory(req.params.storyId, req.user._id)
  res.json({ story: await storyView(story, req.user._id, { full: true }) })
}

export async function listUserStories(req, res) {
  if (!mongoose.isValidObjectId(req.params.userId)) throw httpError(404, 'User not found')
  const canSeeFriends = req.params.userId === req.user._id.toString() || await areFriends(req.user._id, req.params.userId)
  const stories = await Story.find({ user: req.params.userId, ...activeFilter(), ...(canSeeFriends ? {} : { visibility: 'public' }) }).sort({ createdAt: 1 }).populate('user', '-passwordHash')
  res.json({ stories: await Promise.all(stories.map(story => storyView(story, req.user._id))) })
}

export async function deleteStory(req, res) {
  const story = await Story.findOne({ _id: req.params.storyId, user: req.user._id }).select('+mediaPublicId')
  if (!story) throw httpError(404, 'Story not found')
  await Promise.all([StoryView.deleteMany({ story: story._id }), story.deleteOne(), deleteStoryMedia(story.mediaPublicId, story.mediaType).catch(() => {})])
  req.user.friends.forEach(friend => req.app.get('io')?.to(`user:${friend}`).emit('story_deleted', { storyId: req.params.storyId }))
  res.status(204).end()
}

export async function recordStoryView(req, res) {
  const story = await accessibleStory(req.params.storyId, req.user._id)
  if (story.user._id.toString() !== req.user._id.toString()) await StoryView.updateOne({ story: story._id, viewer: req.user._id }, { $setOnInsert: { viewedAt: new Date() } }, { upsert: true })
  res.status(204).end()
}

export async function listStoryViews(req, res) {
  const story = await Story.findOne({ _id: req.params.storyId, user: req.user._id, ...activeFilter() })
  if (!story) throw httpError(404, 'Story not found')
  const views = await StoryView.find({ story: story._id }).sort({ viewedAt: -1 }).populate('viewer', '-passwordHash')
  res.json({ viewers: views.map(view => ({ user: view.viewer.toProfileJSON(), viewedAt: view.viewedAt })) })
}

export async function reactToStory(req, res) {
  const input = reactionInput.safeParse(req.body)
  if (!input.success) throw httpError(400, 'Choose a valid reaction')
  const story = await accessibleStory(req.params.storyId, req.user._id)
  story.reactions = story.reactions.filter(reaction => reaction.user.toString() !== req.user._id.toString())
  story.reactions.push({ user: req.user._id, emoji: input.data.emoji })
  await story.save()
  res.json({ reactions: story.reactions.map(reaction => ({ emoji: reaction.emoji, userId: reaction.user.toString() })) })
}

export async function replyToStory(req, res) {
  const input = replyInput.safeParse(req.body)
  if (!input.success) throw httpError(400, input.error.issues[0].message)
  const story = await accessibleStory(req.params.storyId, req.user._id)
  if (story.user._id.toString() === req.user._id.toString()) throw httpError(400, 'You cannot reply to your own story')
  let chat = await Chat.findOne({ participants: { $all: [req.user._id, story.user._id] } })
  if (!chat) chat = await Chat.create({ participants: [req.user._id, story.user._id] })
  const message = await Message.create({ chat: chat._id, sender: req.user._id, text: input.data.text, story: story._id })
  await Chat.findByIdAndUpdate(chat._id, { lastMessage: message._id, updatedAt: new Date() })
  await message.populate([{ path: 'sender', select: '-passwordHash' }, { path: 'story', populate: { path: 'user', select: '-passwordHash' } }])
  const view = messageView(message)
  req.app.get('io')?.to(`user:${story.user._id}`).emit('message_received', { message: view })
  res.status(201).json({ message: view, chatId: chat._id.toString() })
}
