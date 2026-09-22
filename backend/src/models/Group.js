import mongoose from 'mongoose'

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  avatar: { type: String, default: '' },
  avatarPublicId: { type: String, default: '', select: false },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
}, { timestamps: true })

groupSchema.index({ members: 1, updatedAt: -1 })
export default mongoose.model('Group', groupSchema)
