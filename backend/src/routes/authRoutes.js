import { Router } from 'express'
import { completePasswordReset, deleteAvatarImage, login, me, register, requestPasswordReset, updateAvatar, updateProfile } from '../controllers/authController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { authRateLimit, passwordResetRateLimit } from '../middleware/rateLimitMiddleware.js'
import { avatarUpload } from '../middleware/uploadMiddleware.js'

const router = Router()
router.post('/register', authRateLimit, register)
router.post('/login', authRateLimit, login)
router.post('/forgot-password', passwordResetRateLimit, requestPasswordReset)
router.post('/reset-password', passwordResetRateLimit, completePasswordReset)
router.get('/me', requireAuth, me)
router.patch('/profile', requireAuth, updateProfile)
router.put('/profile/avatar', requireAuth, avatarUpload, updateAvatar)
router.delete('/profile/avatar', requireAuth, deleteAvatarImage)
export default router
