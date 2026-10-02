import { Router } from 'express'
import { deleteAnonymousMessage, getInboxSettings, listAnonymousMessages, reportAnonymousMessage, sendAnonymousMessage, updateInboxSettings } from '../controllers/anonymousInboxController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import rateLimit from 'express-rate-limit'

const router = Router()
const sendRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false })
router.post('/public/:username', sendRateLimit, sendAnonymousMessage)
router.use(requireAuth)
router.get('/settings', getInboxSettings)
router.patch('/settings', updateInboxSettings)
router.get('/', listAnonymousMessages)
router.delete('/:messageId', deleteAnonymousMessage)
router.post('/:messageId/report', reportAnonymousMessage)
export default router
