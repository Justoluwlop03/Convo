import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import { avatarUpload, privateMessageImageUpload, voiceNoteFileUpload } from '../middleware/uploadMiddleware.js'
import { addAdmin, addMembers, createGroup, createGroupImageMessage, createGroupMessage, createGroupVoiceMessage, deleteGroup, getGroup, getGroupMessages, leaveGroup, listGroups, removeAdmin, removeMember, setGroupLock, updateGroup } from '../controllers/groupController.js'
import { mediaUploadRateLimit } from '../middleware/rateLimitMiddleware.js'
const router = Router(); router.use(requireAuth)
router.post('/', mediaUploadRateLimit, avatarUpload, createGroup); router.get('/', listGroups); router.get('/:groupId', getGroup); router.patch('/:groupId', mediaUploadRateLimit, avatarUpload, updateGroup); router.delete('/:groupId', deleteGroup)
router.post('/:groupId/members', addMembers); router.delete('/:groupId/members/:userId', removeMember); router.post('/:groupId/admins/:userId', addAdmin); router.delete('/:groupId/admins/:userId', removeAdmin); router.post('/:groupId/leave', leaveGroup); router.get('/:groupId/messages', getGroupMessages); router.post('/:groupId/messages', createGroupMessage); router.post('/:groupId/images', mediaUploadRateLimit, privateMessageImageUpload, createGroupImageMessage); router.post('/:groupId/voice', mediaUploadRateLimit, voiceNoteFileUpload, createGroupVoiceMessage)
router.patch('/:groupId/lock', setGroupLock)
export default router
