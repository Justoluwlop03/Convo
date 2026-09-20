import mongoose from 'mongoose'
import User from '../models/User.js'
import { httpError } from '../middleware/errorMiddleware.js'

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function relationshipFor(currentUser, otherUserId) {
  const contains = (ids = []) => ids.some(id => id.toString() === otherUserId.toString())
  if (contains(currentUser.friends)) return 'friends'
  if (contains(currentUser.sentFriendRequests)) return 'outgoing'
  if (contains(currentUser.receivedFriendRequests)) return 'incoming'
  return 'none'
}

function profileView(user, currentUser) {
  return { ...user.toProfileJSON(), relationship: relationshipFor(currentUser, user._id) }
}

export async function getRecommendedUsers(req, res) {
  const users = await User.find({
    _id: { $ne: req.user._id },
    username: { $regex: /\S/ },
  })
    .sort({ isOnline: -1, username: 1 })
    .limit(20)
  res.json({ users: users.map(user => profileView(user, req.user)) })
}

export async function searchUsers(req, res) {
  const query = String(req.query.q || '').trim()
  if (!query) return res.json({ users: [] })
  const users = await User.find({
    _id: { $ne: req.user._id },
    username: { $regex: escapeRegex(query), $options: 'i' },
  }).sort({ username: 1 }).limit(20)
  res.json({ users: users.map(user => profileView(user, req.user)) })
}

export async function getUser(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'User not found')
  const user = await User.findById(req.params.id)
  if (!user) throw httpError(404, 'User not found')
  res.json({ user: profileView(user, req.user) })
}

export async function sendFriendRequest(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'User not found')
  if (req.params.id === req.user._id.toString()) throw httpError(400, 'You cannot add yourself')
  const recipient = await User.findById(req.params.id)
  if (!recipient) throw httpError(404, 'User not found')
  const relationship = relationshipFor(req.user, recipient._id)
  if (relationship === 'friends') throw httpError(409, 'You are already friends')
  if (relationship === 'outgoing') throw httpError(409, 'Friend request already sent')
  if (relationship === 'incoming') throw httpError(409, 'This user has already sent you a request')
  await Promise.all([
    User.findByIdAndUpdate(req.user._id, { $addToSet: { sentFriendRequests: recipient._id } }),
    User.findByIdAndUpdate(recipient._id, { $addToSet: { receivedFriendRequests: req.user._id } }),
  ])
  res.status(201).json({ user: { ...recipient.toProfileJSON(), relationship: 'outgoing' } })
}

async function requestUser(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'Friend request not found')
  const sender = await User.findById(req.params.id)
  if (!sender || !req.user.receivedFriendRequests.some(id => id.toString() === sender._id.toString())) {
    throw httpError(404, 'Friend request not found')
  }
  return sender
}

export async function listFriendRequests(req, res) {
  const users = await User.find({ _id: { $in: req.user.receivedFriendRequests } }).sort({ username: 1 })
  res.json({ requests: users.map(user => profileView(user, req.user)) })
}

export async function acceptFriendRequest(req, res) {
  const sender = await requestUser(req)
  await Promise.all([
    User.findByIdAndUpdate(req.user._id, { $pull: { receivedFriendRequests: sender._id }, $addToSet: { friends: sender._id } }),
    User.findByIdAndUpdate(sender._id, { $pull: { sentFriendRequests: req.user._id }, $addToSet: { friends: req.user._id } }),
  ])
  res.json({ user: { ...sender.toProfileJSON(), relationship: 'friends' } })
}

export async function declineFriendRequest(req, res) {
  const sender = await requestUser(req)
  await Promise.all([
    User.findByIdAndUpdate(req.user._id, { $pull: { receivedFriendRequests: sender._id } }),
    User.findByIdAndUpdate(sender._id, { $pull: { sentFriendRequests: req.user._id } }),
  ])
  res.json({ user: { ...sender.toProfileJSON(), relationship: 'none' } })
}
