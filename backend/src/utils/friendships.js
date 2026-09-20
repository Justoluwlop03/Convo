import User from '../models/User.js'
import { httpError } from '../middleware/errorMiddleware.js'

export async function areFriends(userId, otherUserId) {
  return Boolean(await User.exists({ _id: userId, friends: otherUserId }))
}

export async function requireFriends(userId, otherUserId) {
  if (!(await areFriends(userId, otherUserId))) {
    throw httpError(403, 'You can only chat with accepted friends')
  }
}

export async function requireChatFriendship(chat, userId) {
  const otherUserId = chat?.participants.find(participant => participant.toString() !== userId.toString())
  if (!otherUserId) throw httpError(403, 'Chat access denied')
  await requireFriends(userId, otherUserId)
}
