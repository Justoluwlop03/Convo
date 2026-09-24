import mongoose from 'mongoose'

const stickerSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  url: { type: String, required: true },
  publicId: { type: String, required: true, select: false },
}, { timestamps: true })

export default mongoose.model('Sticker', stickerSchema)
