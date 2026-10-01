import mongoose from 'mongoose'

const adminBroadcastSchema = new mongoose.Schema({
  subject: { type: String, required: true, maxlength: 150 },
  message: { type: String, required: true, maxlength: 12000 },
  recipientsCount: { type: Number, required: true, min: 0 },
  sentCount: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['queued', 'sending', 'sent', 'failed'], default: 'queued' },
  error: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  completedAt: { type: Date, default: null },
}, { timestamps: true })

export default mongoose.model('AdminBroadcast', adminBroadcastSchema)
