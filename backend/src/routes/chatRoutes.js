import { Router } from 'express'
import { createChat, deleteChat, getChat, listChats, unreadCount } from '../controllers/chatController.js'
import { requireAuth } from '../middleware/authMiddleware.js'

const router = Router()
router.use(requireAuth)
router.post('/', createChat)
router.get('/', listChats)
router.get('/unread-count', unreadCount)
router.get('/:id', getChat)
router.delete('/:id', deleteChat)
export default router
