import mongoose from 'mongoose'

const storyViewSchema = new mongoose.Schema({
  story: { type: mongoose.Schema.Types.ObjectId, ref: 'Story', required: true },
  viewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  viewedAt: { type: Date, default: Date.now },
}, { timestamps: false })

storyViewSchema.index({ story: 1, viewer: 1 }, { unique: true })
storyViewSchema.index({ viewer: 1, viewedAt: -1 })
export default mongoose.model('StoryView', storyViewSchema)
