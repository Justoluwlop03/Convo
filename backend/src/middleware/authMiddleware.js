import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { httpError } from './errorMiddleware.js'

export async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
    if (!token) throw httpError(401, 'Authentication required')
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(payload.userId).select('+avatarPublicId')
    if (!user) throw httpError(401, 'User no longer exists')
    req.user = user
    next()
  } catch (error) {
    next(error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' ? httpError(401, 'Invalid or expired token') : error)
  }
}
