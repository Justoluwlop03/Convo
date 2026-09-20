import { Router } from 'express'
import { acceptFriendRequest, declineFriendRequest, getRecommendedUsers, getUser, listFriendRequests, searchUsers, sendFriendRequest } from '../controllers/userController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { searchRateLimit } from '../middleware/rateLimitMiddleware.js'

const router = Router()
router.use(requireAuth)
router.get('/recommended', getRecommendedUsers)
router.get('/search', searchRateLimit, searchUsers)
router.get('/friend-requests', listFriendRequests)
router.post('/:id/friend-request', sendFriendRequest)
router.post('/friend-requests/:id/accept', acceptFriendRequest)
router.post('/friend-requests/:id/decline', declineFriendRequest)
router.get('/:id', getUser)
export default router
