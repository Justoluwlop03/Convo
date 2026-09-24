import mongoose from 'mongoose'
import { z } from 'zod'
import User from '../models/User.js'
import Post from '../models/Post.js'
import PostLike from '../models/PostLike.js'
import PostComment from '../models/PostComment.js'
import PostView from '../models/PostView.js'
import { httpError } from '../middleware/errorMiddleware.js'
import { deletePostMedia, uploadPostMedia } from '../config/cloudinary.js'

const captionInput = z.string().trim().max(2200).optional().default('')
const commentInput = z.object({ text: z.string().trim().min(1).max(1000) })
const validId = value => mongoose.isValidObjectId(value)
const pagination = query => ({ page: Math.max(1, Number.parseInt(query.page, 10) || 1), limit: Math.min(24, Math.max(1, Number.parseInt(query.limit, 10) || 12)) })

function postView(post, viewerId, liked = false) {
  const mediaItems = post.mediaItems?.length ? post.mediaItems : (post.mediaUrl ? [{ url: post.mediaUrl }] : [])
  return {
    id: post._id.toString(),
    user: post.user?.toProfileJSON?.() || { id: post.user?._id?.toString?.(), username: post.user?.username || '', displayName: post.user?.displayName || '', avatar: post.user?.avatar || '' },
    mediaUrl: mediaItems[0]?.url || post.mediaUrl || '', mediaUrls: mediaItems.map(item => item.url).filter(Boolean), mediaType: post.mediaType, caption: post.caption || '',
    likesCount: post.likesCount || 0, commentsCount: post.commentsCount || 0, viewsCount: post.viewsCount || 0,
    likedByMe: Boolean(liked), createdAt: post.createdAt,
  }
}

async function findPost(postId) {
  if (!validId(postId)) throw httpError(404, 'Post not found')
  const post = await Post.findById(postId).populate('user', 'username displayName avatar bio about isOnline lastSeen createdAt')
  if (!post) throw httpError(404, 'Post not found')
  return post
}

export async function createPost(req, res) {
  const parsedCaption = captionInput.safeParse(req.body.caption || '')
  if (!parsedCaption.success) throw httpError(400, parsedCaption.error.issues[0].message)
  const files = req.files || []
  if (files.length > 6) throw httpError(400, 'Choose up to 6 images per post')
  const containsVideo = files.some(file => file.mimetype.startsWith('video/'))
  if (containsVideo && (files.length !== 1 || !files[0].mimetype.startsWith('video/'))) throw httpError(400, 'Post one video at a time, or choose up to 6 images')
  if (!containsVideo && files.length > 6) throw httpError(400, 'Choose up to 6 images per post')
  if (!files.length && !parsedCaption.data) throw httpError(400, 'Add a caption or choose up to 6 images')
  const uploads = []
  const mediaType = containsVideo ? 'video' : files.length ? 'image' : 'text'
  let post
  try {
    for (const file of files) uploads.push(await uploadPostMedia(file.buffer, mediaType))
    post = await Post.create({
      user: req.user._id,
      caption: parsedCaption.data,
      mediaType,
      mediaUrl: uploads[0]?.secure_url || '',
      mediaItems: uploads.map(upload => ({ url: upload.secure_url, publicId: upload.public_id })),
    })
  } catch (error) {
    await Promise.all(uploads.map(upload => deletePostMedia(upload.public_id, mediaType).catch(() => {})))
    throw error
  }
  await post.populate('user', 'username displayName avatar bio about isOnline lastSeen createdAt')
  res.status(201).json({ post: postView(post, req.user._id) })
}

export async function listUserPosts(req, res) {
  if (!validId(req.params.userId)) throw httpError(404, 'User not found')
  const profileUser = await User.findById(req.params.userId).select('_id blockedUsers')
  if (!profileUser) throw httpError(404, 'User not found')
  if (profileUser._id.toString() !== req.user._id.toString()) {
    const [viewerBlocks, profileBlocks] = await Promise.all([
      User.exists({ _id: req.user._id, blockedUsers: profileUser._id }),
      User.exists({ _id: profileUser._id, blockedUsers: req.user._id }),
    ])
    if (viewerBlocks || profileBlocks) throw httpError(403, 'You cannot view this user’s posts')
  }
  const { page, limit } = pagination(req.query)
  const likedTab = req.query.tab === 'liked'
  if (likedTab && profileUser._id.toString() !== req.user._id.toString()) throw httpError(403, 'Liked posts are only visible on your own profile')

  let posts
  let hasMore
  if (likedTab) {
    const likes = await PostLike.find({ user: req.user._id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit + 1)
      .populate({ path: 'post', populate: { path: 'user', select: 'username displayName avatar bio about isOnline lastSeen createdAt' } })
    hasMore = likes.length > limit
    posts = likes.slice(0, limit).map(like => like.post).filter(Boolean)
  } else {
    const found = await Post.find({ user: profileUser._id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit + 1)
      .populate('user', 'username displayName avatar bio about isOnline lastSeen createdAt')
    hasMore = found.length > limit
    posts = found.slice(0, limit)
  }
  const likedIds = likedTab || !posts.length ? new Set(posts.map(post => post._id.toString())) : new Set((await PostLike.find({ user: req.user._id, post: { $in: posts.map(post => post._id) } }).select('post')).map(like => like.post.toString()))
  res.json({ posts: posts.map(post => postView(post, req.user._id, likedIds.has(post._id.toString()))), page, hasMore })
}

export async function listFeedPosts(req, res) {
  const { page, limit } = pagination(req.query)
  const userIds = [...new Set([req.user._id.toString(), ...(req.user.friends || []).map(id => id.toString())])]
  const found = await Post.find({ user: { $in: userIds } }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit + 1)
    .populate('user', 'username displayName avatar bio about isOnline lastSeen createdAt')
  const hasMore = found.length > limit
  const posts = found.slice(0, limit)
  const likedIds = posts.length ? new Set((await PostLike.find({ user: req.user._id, post: { $in: posts.map(post => post._id) } }).select('post')).map(like => like.post.toString())) : new Set()
  res.json({ posts: posts.map(post => postView(post, req.user._id, likedIds.has(post._id.toString()))), page, hasMore })
}

export async function recordPostView(req, res) {
  const post = await findPost(req.params.postId)
  if (post.user._id.toString() !== req.user._id.toString()) {
    try {
      await PostView.create({ post: post._id, viewer: req.user._id })
      await Post.updateOne({ _id: post._id }, { $inc: { viewsCount: 1 } })
    } catch (error) {
      if (error.code !== 11000) throw error
    }
  }
  const updated = await findPost(req.params.postId)
  res.json({ post: postView(updated, req.user._id) })
}

export async function getPost(req, res) {
  const post = await findPost(req.params.postId)
  const liked = await PostLike.exists({ post: post._id, user: req.user._id })
  res.json({ post: postView(post, req.user._id, Boolean(liked)) })
}

export async function deletePost(req, res) {
  const post = await findPost(req.params.postId)
  if (post.user._id.toString() !== req.user._id.toString()) throw httpError(403, 'You can only delete your own posts')
  const mediaPublicId = await Post.findById(post._id).select('+mediaPublicId').then(value => value?.mediaPublicId)
  const mediaItems = post.mediaItems || []
  await Promise.all([PostLike.deleteMany({ post: post._id }), PostComment.deleteMany({ post: post._id }), PostView.deleteMany({ post: post._id }), post.deleteOne()])
  await Promise.all([...mediaItems.map(item => item.publicId).filter(Boolean), mediaPublicId].map(publicId => deletePostMedia(publicId, post.mediaType).catch(() => {})))
  res.status(204).end()
}

export async function likePost(req, res) {
  const post = await findPost(req.params.postId)
  try {
    await PostLike.create({ post: post._id, user: req.user._id })
    await Post.updateOne({ _id: post._id }, { $inc: { likesCount: 1 } })
  } catch (error) {
    if (error.code !== 11000) throw error
  }
  const updated = await findPost(req.params.postId)
  res.json({ post: postView(updated, req.user._id, true) })
}

export async function unlikePost(req, res) {
  const post = await findPost(req.params.postId)
  const result = await PostLike.deleteOne({ post: post._id, user: req.user._id })
  if (result.deletedCount) await Post.updateOne({ _id: post._id, likesCount: { $gt: 0 } }, { $inc: { likesCount: -1 } })
  const updated = await findPost(req.params.postId)
  res.json({ post: postView(updated, req.user._id, false) })
}

export async function listPostLikes(req, res) {
  const post = await findPost(req.params.postId)
  const { page, limit } = pagination(req.query)
  const likes = await PostLike.find({ post: post._id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit + 1).populate('user', 'username displayName avatar')
  const hasMore = likes.length > limit
  res.json({ users: likes.slice(0, limit).map(like => ({ id: like.user._id.toString(), username: like.user.username, displayName: like.user.displayName || '', avatar: like.user.avatar || '' })), page, hasMore })
}

export async function listPostComments(req, res) {
  const post = await findPost(req.params.postId)
  const { page, limit } = pagination({ ...req.query, limit: req.query.limit || 30 })
  const comments = await PostComment.find({ post: post._id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit + 1).populate('user', 'username displayName avatar')
  const hasMore = comments.length > limit
  res.json({ comments: comments.slice(0, limit).reverse().map(comment => ({ id: comment._id.toString(), user: { id: comment.user._id.toString(), username: comment.user.username, displayName: comment.user.displayName || '', avatar: comment.user.avatar || '' }, text: comment.text, createdAt: comment.createdAt })), page, hasMore })
}

export async function createPostComment(req, res) {
  const input = commentInput.safeParse(req.body)
  if (!input.success) throw httpError(400, input.error.issues[0].message)
  const post = await findPost(req.params.postId)
  const comment = await PostComment.create({ post: post._id, user: req.user._id, text: input.data.text })
  await Post.updateOne({ _id: post._id }, { $inc: { commentsCount: 1 } })
  await comment.populate('user', 'username displayName avatar')
  res.status(201).json({ comment: { id: comment._id.toString(), user: { id: comment.user._id.toString(), username: comment.user.username, displayName: comment.user.displayName || '', avatar: comment.user.avatar || '' }, text: comment.text, createdAt: comment.createdAt }, commentsCount: post.commentsCount + 1 })
}

export async function deletePostComment(req, res) {
  if (!validId(req.params.commentId)) throw httpError(404, 'Comment not found')
  const comment = await PostComment.findOne({ _id: req.params.commentId, post: req.params.postId })
  if (!comment) throw httpError(404, 'Comment not found')
  const post = await findPost(req.params.postId)
  if (comment.user.toString() !== req.user._id.toString() && post.user._id.toString() !== req.user._id.toString()) throw httpError(403, 'You cannot delete this comment')
  await comment.deleteOne()
  if (post.commentsCount > 0) await Post.updateOne({ _id: post._id, commentsCount: { $gt: 0 } }, { $inc: { commentsCount: -1 } })
  res.status(204).end()
}
