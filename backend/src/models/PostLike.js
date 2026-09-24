import mongoose from 'mongoose'

const postLikeSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

postLikeSchema.index({ post: 1, user: 1 }, { unique: true })
postLikeSchema.index({ user: 1, createdAt: -1 })
export default mongoose.model('PostLike', postLikeSchema)
