import mongoose from 'mongoose'

const postViewSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  viewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  viewedAt: { type: Date, default: Date.now },
}, { timestamps: false })

postViewSchema.index({ post: 1, viewer: 1 }, { unique: true })
postViewSchema.index({ viewer: 1, viewedAt: -1 })
export default mongoose.model('PostView', postViewSchema)
