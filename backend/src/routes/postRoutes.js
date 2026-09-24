import { Router } from 'express'
import { requireAuth } from '../middleware/authMiddleware.js'
import { postMediaUpload } from '../middleware/uploadMiddleware.js'
import { createPost, createPostComment, deletePost, deletePostComment, getPost, likePost, listFeedPosts, listPostComments, listPostLikes, listUserPosts, recordPostView, unlikePost } from '../controllers/postController.js'

const router = Router()
router.use(requireAuth)
router.post('/', postMediaUpload, createPost)
router.get('/feed', listFeedPosts)
router.get('/user/:userId', listUserPosts)
router.post('/:postId/view', recordPostView)
router.get('/:postId', getPost)
router.delete('/:postId', deletePost)
router.post('/:postId/like', likePost)
router.delete('/:postId/like', unlikePost)
router.get('/:postId/likes', listPostLikes)
router.get('/:postId/comments', listPostComments)
router.post('/:postId/comments', createPostComment)
router.delete('/:postId/comments/:commentId', deletePostComment)
export default router
