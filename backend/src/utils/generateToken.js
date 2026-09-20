import jwt from 'jsonwebtoken'

export function generateToken(userId) {
  return jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })
}
