import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: false, index: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 5000 },
  imageUrl: { type: String, default: '' },
  imagePublicId: { type: String, default: '', select: false },
  type: { type: String, enum: ['text', 'image', 'voice', 'sticker'], default: 'text' },
  stickerId: { type: String, default: '' },
  stickerUrl: { type: String, default: '' },
  audioUrl: { type: String, default: '' },
  audioPublicId: { type: String, default: '', select: false },
  duration: { type: Number, default: 0 },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  story: { type: mongoose.Schema.Types.ObjectId, ref: 'Story', default: null },
  editedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
  read: { type: Boolean, default: false },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deliveredAt: { type: Date, default: null },
  readAt: { type: Date, default: null },
}, { timestamps: true })

messageSchema.index({ chat: 1, createdAt: -1 })
messageSchema.index({ group: 1, createdAt: -1 })
messageSchema.index({ chat: 1, sender: 1, readBy: 1 })
messageSchema.index({ group: 1, sender: 1, readBy: 1 })
messageSchema.pre('validate', function validateConversation() {
  if ((this.chat && this.group) || (!this.chat && !this.group)) {
    throw new Error('A message must belong to exactly one conversation')
  }
})
export default mongoose.model('Message', messageSchema)
