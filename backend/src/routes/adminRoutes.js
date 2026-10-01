import { Router } from 'express'
import mongoose from 'mongoose'
import { requireAuth } from '../middleware/authMiddleware.js'
import User from '../models/User.js'
import Message from '../models/Message.js'
import Chat from '../models/Chat.js'
import Group from '../models/Group.js'
import { createAdminBroadcast, listAdminBroadcasts } from '../controllers/adminBroadcastController.js'
import { adminBroadcastRateLimit } from '../middleware/rateLimitMiddleware.js'

const router = Router()
router.use(requireAuth)

function adminEmails() {
  return new Set((process.env.ADMIN_EMAILS || '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean))
}

router.get('/access', (req, res) => {
  res.json({ isAdmin: adminEmails().has(req.user.email.toLowerCase()) })
})

router.use((req, res, next) => {
  if (!adminEmails().has(req.user.email.toLowerCase())) {
    return res.status(403).json({ message: 'This account is not on the admin allowlist. Set ADMIN_EMAILS in the backend environment.' })
  }
  next()
})

router.get('/overview', async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    const [users, onlineUsers, messages, chats, groups, newUsers, recentUsers, messageActivity] = await Promise.all([
      User.countDocuments(), User.countDocuments({ isOnline: true }), Message.countDocuments(), Chat.countDocuments(), Group.countDocuments(),
      User.countDocuments({ createdAt: { $gte: since } }),
      User.find().sort({ createdAt: -1 }).limit(6).select('username displayName email avatar isOnline isBanned createdAt').lean(),
      Message.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    ])
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index))
      const key = date.toISOString().slice(0, 10)
      return { date: key, count: messageActivity.find(item => item._id === key)?.count || 0 }
    })
    const sockets = req.app.get('io')?.engine?.clientsCount || 0
    res.json({
      generatedAt: new Date().toISOString(),
      system: { api: 'operational', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', uptimeSeconds: Math.floor(process.uptime()), memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024), sockets, environment: process.env.NODE_ENV || 'development' },
      metrics: { users, onlineUsers, messages, chats, groups, newUsers },
      activity: days,
      recentUsers: recentUsers.map(user => ({ id: user._id.toString(), username: user.username, displayName: user.displayName, email: user.email, avatar: user.avatar, online: user.isOnline, isBanned: user.isBanned, createdAt: user.createdAt })),
    })
  } catch (error) { next(error) }
})

router.get('/users', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim().slice(0, 80)
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 25))
    const filter = search
      ? { $or: ['username', 'displayName', 'email'].map(field => ({ [field]: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } })) }
      : {}
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('username displayName email avatar isOnline isBanned createdAt').lean(),
      User.countDocuments(filter),
    ])
    const admins = adminEmails()
    res.json({ users: users.map(user => ({ id: user._id.toString(), username: user.username, displayName: user.displayName, email: user.email, avatar: user.avatar, online: user.isOnline, isBanned: user.isBanned, isAdmin: admins.has(user.email.toLowerCase()), createdAt: user.createdAt })), total, page, pages: Math.max(1, Math.ceil(total / limit)) })
  } catch (error) { next(error) }
})

router.get('/broadcasts', listAdminBroadcasts)
router.post('/broadcasts', adminBroadcastRateLimit, createAdminBroadcast)

router.patch('/users/:id/ban', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'User not found' })
    if (typeof req.body?.isBanned !== 'boolean') return res.status(400).json({ message: 'isBanned must be a boolean' })
    const target = await User.findById(req.params.id).select('username displayName email avatar isOnline isBanned createdAt')
    if (!target) return res.status(404).json({ message: 'User not found' })
    if (target._id.equals(req.user._id) || adminEmails().has(target.email.toLowerCase())) {
      return res.status(400).json({ message: 'Admin accounts cannot be banned.' })
    }
    target.isBanned = req.body.isBanned
    if (target.isBanned) target.isOnline = false
    await target.save()
    if (target.isBanned) req.app.get('io')?.in(`user:${target._id}`).disconnectSockets(true)
    res.json({ user: { id: target._id.toString(), username: target.username, displayName: target.displayName, email: target.email, avatar: target.avatar, online: target.isOnline, isBanned: target.isBanned, createdAt: target.createdAt } })
  } catch (error) { next(error) }
})

export default router
