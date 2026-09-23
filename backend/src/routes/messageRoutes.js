import { Router } from 'express'
import { createImageMessage, createMessage, createVoiceMessage, deleteMessage, editMessage, getMessages, markRead } from '../controllers/messageController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { privateMessageImageUpload, voiceNoteFileUpload } from '../middleware/uploadMiddleware.js'

const router = Router()
router.use(requireAuth)
router.get('/:chatId', getMessages)
router.post('/', createMessage)
router.post('/:chatId/images', privateMessageImageUpload, createImageMessage)
router.post('/:chatId/voice', voiceNoteFileUpload, createVoiceMessage)
router.patch('/:id', editMessage)
router.patch('/:id/read', markRead)
router.delete('/:id', deleteMessage)
export default router
