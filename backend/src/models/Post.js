import mongoose from 'mongoose'

const postSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  mediaUrl: { type: String, default: '' },
  mediaPublicId: { type: String, default: '', select: false },
  mediaItems: [{ url: { type: String, default: '' }, publicId: { type: String, default: '' } }],
  mediaType: { type: String, enum: ['text', 'image', 'video'], default: 'text' },
  caption: { type: String, trim: true, maxlength: 2200, default: '' },
  likesCount: { type: Number, min: 0, default: 0 },
  commentsCount: { type: Number, min: 0, default: 0 },
  viewsCount: { type: Number, min: 0, default: 0 },
}, { timestamps: true })

postSchema.index({ user: 1, createdAt: -1 })
export default mongoose.model('Post', postSchema)
