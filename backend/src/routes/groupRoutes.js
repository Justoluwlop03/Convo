import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import { avatarUpload } from '../middleware/uploadMiddleware.js'
import { addAdmin, addMembers, createGroup, createGroupMessage, deleteGroup, getGroup, getGroupMessages, leaveGroup, listGroups, removeAdmin, removeMember, updateGroup } from '../controllers/groupController.js'
const router = Router(); router.use(requireAuth)
router.post('/', avatarUpload, createGroup); router.get('/', listGroups); router.get('/:groupId', getGroup); router.patch('/:groupId', avatarUpload, updateGroup); router.delete('/:groupId', deleteGroup)
router.post('/:groupId/members', addMembers); router.delete('/:groupId/members/:userId', removeMember); router.post('/:groupId/admins/:userId', addAdmin); router.delete('/:groupId/admins/:userId', removeAdmin); router.post('/:groupId/leave', leaveGroup); router.get('/:groupId/messages', getGroupMessages); router.post('/:groupId/messages', createGroupMessage)
export default router
