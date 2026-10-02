import mongoose from 'mongoose'

const anonymousMessageSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
  reported: { type: Boolean, default: false },
}, { timestamps: true })

anonymousMessageSchema.index({ recipient: 1, createdAt: -1 })
export default mongoose.model('AnonymousMessage', anonymousMessageSchema)
