import Chat from '../models/Chat.js'
import Group from '../models/Group.js'
import Message from '../models/Message.js'
import { unreadMessageCondition } from './unreadMessages.js'

export async function unreadTotalFor(userId) {
  const [chats, groups] = await Promise.all([
    Chat.find({ participants: userId }).select('_id'),
    Group.find({ members: userId }).select('_id'),
  ])
  return Message.countDocuments({
    $and: [
      { $or: [{ chat: { $in: chats.map(chat => chat._id) } }, { group: { $in: groups.map(group => group._id) } }] },
      unreadMessageCondition(userId),
    ],
  })
}
