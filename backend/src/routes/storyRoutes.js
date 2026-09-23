import { Router } from 'express'
import { createStory, deleteStory, getStory, listStories, listStoryViews, listUserStories, reactToStory, recordStoryView, replyToStory } from '../controllers/storyController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { storyUpload } from '../middleware/uploadMiddleware.js'

const router = Router()
router.use(requireAuth)
router.post('/', storyUpload, createStory)
router.get('/', listStories)
router.get('/user/:userId', listUserStories)
router.get('/:storyId', getStory)
router.delete('/:storyId', deleteStory)
router.post('/:storyId/views', recordStoryView)
router.get('/:storyId/views', listStoryViews)
router.put('/:storyId/reaction', reactToStory)
router.post('/:storyId/reply', replyToStory)
export default router
