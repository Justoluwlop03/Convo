import { Router } from 'express'
import { deleteAvatarImage, login, me, register, updateAvatar } from '../controllers/authController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { authRateLimit } from '../middleware/rateLimitMiddleware.js'
import { avatarUpload } from '../middleware/uploadMiddleware.js'

const router = Router()
router.post('/register', authRateLimit, register)
router.post('/login', authRateLimit, login)
router.get('/me', requireAuth, me)
router.put('/profile/avatar', requireAuth, avatarUpload, updateAvatar)
router.delete('/profile/avatar', requireAuth, deleteAvatarImage)
export default router
