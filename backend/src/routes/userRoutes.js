import { Router } from 'express'
import { acceptFriendRequest, declineFriendRequest, getNotificationSettings, getRecommendedUsers, getUser, listFriends, listFriendRequests, searchUsers, sendFriendRequest, updateNotificationSettings } from '../controllers/userController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { searchRateLimit } from '../middleware/rateLimitMiddleware.js'
import { deletePushSubscription, getPushConfiguration, savePushSubscription } from '../controllers/notificationController.js'

const router = Router()
router.use(requireAuth)
router.get('/recommended', getRecommendedUsers)
router.get('/search', searchRateLimit, searchUsers)
router.get('/friend-requests', listFriendRequests)
router.get('/friends', listFriends)
router.get('/notification-settings', getNotificationSettings)
router.patch('/notification-settings', updateNotificationSettings)
router.get('/push-configuration', getPushConfiguration)
router.post('/push-subscriptions', savePushSubscription)
router.delete('/push-subscriptions', deletePushSubscription)
router.post('/:id/friend-request', sendFriendRequest)
router.post('/friend-requests/:id/accept', acceptFriendRequest)
router.post('/friend-requests/:id/decline', declineFriendRequest)
router.get('/:id', getUser)
export default router
