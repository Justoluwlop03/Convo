import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true, trim: true, minlength: 2, maxlength: 30 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  avatar: { type: String, default: '' },
  avatarPublicId: { type: String, default: '', select: false },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
}, { timestamps: true })

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return { id: this._id.toString(), username: this.username, email: this.email, avatar: this.avatar, online: this.isOnline, lastSeen: this.lastSeen }
}

export default mongoose.model('User', userSchema)
