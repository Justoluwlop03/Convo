import { Router } from 'express'
import { getRecommendedUsers, getUser, searchUsers } from '../controllers/userController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { searchRateLimit } from '../middleware/rateLimitMiddleware.js'

const router = Router()
router.use(requireAuth)
router.get('/recommended', getRecommendedUsers)
router.get('/search', searchRateLimit, searchUsers)
router.get('/:id', getUser)
export default router
