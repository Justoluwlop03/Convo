import mongoose from 'mongoose'
import User from '../models/User.js'
import { httpError } from '../middleware/errorMiddleware.js'

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export async function getRecommendedUsers(req, res) {
  const users = await User.find({
    _id: { $ne: req.user._id },
    username: { $regex: /\S/ },
  })
    .sort({ isOnline: -1, username: 1 })
    .limit(20)
  res.json({ users: users.map(user => user.toPublicJSON()) })
}

export async function searchUsers(req, res) {
  const query = String(req.query.q || '').trim()
  if (!query) return res.json({ users: [] })
  const users = await User.find({
    _id: { $ne: req.user._id },
    username: { $regex: escapeRegex(query), $options: 'i' },
  }).sort({ username: 1 }).limit(20)
  res.json({ users: users.map(user => user.toPublicJSON()) })
}

export async function getUser(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(404, 'User not found')
  const user = await User.findById(req.params.id)
  if (!user) throw httpError(404, 'User not found')
  res.json({ user: user.toPublicJSON() })
}
