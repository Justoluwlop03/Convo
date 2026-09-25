import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true, trim: true, minlength: 2, maxlength: 30 },
  displayName: { type: String, default: '', trim: true, maxlength: 50 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpiresAt: { type: Date, select: false },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '', trim: true, maxlength: 160 },
  about: { type: String, default: '', trim: true, maxlength: 1000 },
  avatarPublicId: { type: String, default: '', select: false },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  sentFriendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  receivedFriendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  notificationSettings: {
    alertsEnabled: { type: Boolean, default: true },
    showPreview: { type: Boolean, default: true },
    mutedConversationIds: [{ type: mongoose.Schema.Types.ObjectId }],
  },
  favoriteStickers: { type: [String], default: [] },
  recentStickers: { type: [String], default: [] },
}, { timestamps: true })

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return { id: this._id.toString(), username: this.username, displayName: this.displayName || '', email: this.email, avatar: this.avatar, bio: this.bio, about: this.about, online: this.isOnline, lastSeen: this.lastSeen }
}

userSchema.methods.toProfileJSON = function toProfileJSON() {
  return { id: this._id.toString(), username: this.username, displayName: this.displayName || '', avatar: this.avatar, bio: this.bio, about: this.about, online: this.isOnline, lastSeen: this.lastSeen, createdAt: this.createdAt }
}

export default mongoose.model('User', userSchema)
