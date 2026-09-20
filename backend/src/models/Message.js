import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 5000 },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  editedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
  read: { type: Boolean, default: false },
  deliveredAt: { type: Date, default: null },
  readAt: { type: Date, default: null },
}, { timestamps: true })

messageSchema.index({ chat: 1, createdAt: -1 })
export default mongoose.model('Message', messageSchema)
