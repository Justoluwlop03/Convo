import { Router } from 'express'
import { createMessage, deleteMessage, getMessages, markRead } from '../controllers/messageController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()
router.use(requireAuth)
router.get('/:chatId', getMessages)
router.post('/', createMessage)
router.patch('/:id/read', markRead)
router.delete('/:id', deleteMessage)
export default router
