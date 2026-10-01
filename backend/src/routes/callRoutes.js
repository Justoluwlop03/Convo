import { Router } from 'express'
import { getIceServers } from '../controllers/callController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { turnCredentialsRateLimit } from '../middleware/rateLimitMiddleware.js'

const router = Router()
router.get('/ice-servers', requireAuth, turnCredentialsRateLimit, getIceServers)
export default router
