import mongoose from 'mongoose'

const reactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  emoji: { type: String, required: true, maxlength: 8 },
}, { _id: false })

const storySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  mediaUrl: { type: String, required: true },
  mediaPublicId: { type: String, required: true, select: false },
  mediaType: { type: String, enum: ['image', 'video'], required: true },
  caption: { type: String, trim: true, maxlength: 280, default: '' },
  visibility: { type: String, enum: ['friends', 'public'], default: 'friends', required: true },
  expiresAt: { type: Date, required: true, index: true },
  reactions: { type: [reactionSchema], default: [] },
}, { timestamps: true })

storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
storySchema.index({ user: 1, expiresAt: -1 })
export default mongoose.model('Story', storySchema)
