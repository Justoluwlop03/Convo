import mongoose from 'mongoose'

const postCommentSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
}, { timestamps: true })

postCommentSchema.index({ post: 1, createdAt: 1 })
export default mongoose.model('PostComment', postCommentSchema)
