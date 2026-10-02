import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import { createCustomSticker, getStickerData, sendSticker, setStickerFavorite, useSticker } from '../controllers/stickerController.js'
import { privateMessageImageUpload } from '../middleware/uploadMiddleware.js'
import { mediaUploadRateLimit } from '../middleware/rateLimitMiddleware.js'

const router = Router()
router.use(requireAuth)
router.get('/', getStickerData)
router.post('/custom', mediaUploadRateLimit, privateMessageImageUpload, createCustomSticker)
router.post('/send', sendSticker)
router.post('/:stickerId/favorite', setStickerFavorite)
router.post('/:stickerId/recent', useSticker)
export default router
