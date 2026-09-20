import mongoose from 'mongoose'

const chatSchema = new mongoose.Schema({
  participants: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], validate: value => value.length === 2, required: true },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
}, { timestamps: true })

chatSchema.index({ participants: 1 })
export default mongoose.model('Chat', chatSchema)
