import mongoose from 'mongoose'
import { z } from 'zod'
import Group from '../models/Group.js'
import Message from '../models/Message.js'
import User from '../models/User.js'
import { httpError } from '../middleware/errorMiddleware.js'
import { areFriends } from '../utils/friendships.js'
import { uploadGroupAvatar, deleteAvatar } from '../config/cloudinary.js'
import { messageView } from './messageController.js'
import { unreadMessageFilter } from '../utils/unreadMessages.js'
import { sendMessagePush } from '../utils/pushNotifications.js'

const memberIdsInput = z.object({ memberIds: z.array(z.string()).min(1).max(100) })
const createInput = z.object({ name: z.string().trim().min(1).max(80), memberIds: z.array(z.string()).min(1).max(100) })
const updateInput = z.object({ name: z.string().trim().min(1).max(80).optional() })
const lockInput = z.object({ locked: z.boolean() })
const id = value => { if (!mongoose.isValidObjectId(value)) throw httpError(400, 'Invalid id') }
const memberIdsFrom = value => { if (Array.isArray(value)) return value; try { return JSON.parse(value || '[]') } catch { return [] } }
const includes = (ids, userId) => ids.some(value => value.toString() === userId.toString())

function groupView(group, unreadCount = 0) {
  const users = values => values.map(user => user.toPublicJSON())
  return { id: group._id.toString(), type: 'group', name: group.name, avatar: group.avatar, creator: group.creator.toPublicJSON(), admins: users(group.admins), members: users(group.members), memberCount: group.members.length, locked: Boolean(group.locked), lastMessage: group.lastMessage ? { ...group.lastMessage.toObject(), text: group.lastMessage.deletedAt ? 'Message deleted' : group.lastMessage.text } : null, unreadCount, createdAt: group.createdAt, updatedAt: group.updatedAt }
}

const populated = query => query.populate('creator', '-passwordHash').populate('admins', '-passwordHash').populate('members', '-passwordHash').populate('lastMessage')
async function memberGroup(groupId, userId) { id(groupId); const group = await populated(Group.findOne({ _id: groupId, members: userId }).select('+avatarPublicId')); if (!group) throw httpError(404, 'Group not found'); return group }
function requireAdmin(group, userId) { if (!includes(group.admins, userId)) throw httpError(403, 'Only group admins can perform this action') }
function requireCreator(group, userId) { if (group.creator._id.toString() !== userId.toString()) throw httpError(403, 'Only the group creator can remove members') }
async function requireFriendMembers(creatorId, memberIds) {
  const unique = [...new Set(memberIds)]
  if (unique.length !== memberIds.length) throw httpError(409, 'Duplicate members are not allowed')
  for (const userId of unique) { id(userId); if (userId === creatorId.toString() || !(await areFriends(creatorId, userId))) throw httpError(403, 'Members must be accepted friends of the group creator') }
  const count = await User.countDocuments({ _id: { $in: unique } }); if (count !== unique.length) throw httpError(404, 'One or more users were not found')
  return unique
}
async function unreadCount(groupId, userId) { return Message.countDocuments(unreadMessageFilter(userId, { group: groupId })) }

export async function createGroup(req, res) {
  const input = createInput.safeParse({ ...req.body, memberIds: memberIdsFrom(req.body.memberIds) }); if (!input.success) throw httpError(400, input.error.issues[0].message)
  const memberIds = await requireFriendMembers(req.user._id, input.data.memberIds)
  let avatar = '', avatarPublicId = ''
  if (req.file) { const upload = await uploadGroupAvatar(req.file.buffer); avatar = upload.secure_url; avatarPublicId = upload.public_id }
  const group = await Group.create({ name: input.data.name, avatar, avatarPublicId, creator: req.user._id, admins: [req.user._id], members: [req.user._id, ...memberIds] })
  const view = groupView(await populated(Group.findById(group._id)))
  const io = req.app.get('io'); view.members.filter(member => member.id !== req.user._id.toString()).forEach(member => io?.to(`user:${member.id}`).emit('group_added', { group: view }))
  res.status(201).json({ group: view })
}
export async function listGroups(req, res) { const groups = await populated(Group.find({ members: req.user._id }).sort({ updatedAt: -1 })); const views = await Promise.all(groups.map(async group => groupView(group, await unreadCount(group._id, req.user._id)))); res.json({ groups: views }) }
export async function getGroup(req, res) { const group = await memberGroup(req.params.groupId, req.user._id); res.json({ group: groupView(group, await unreadCount(group._id, req.user._id)) }) }
export async function updateGroup(req, res) { const group = await memberGroup(req.params.groupId, req.user._id); requireAdmin(group, req.user._id); const input = updateInput.safeParse(req.body); if (!input.success) throw httpError(400, input.error.issues[0].message); if (!input.data.name && !req.file) throw httpError(400, 'Provide a group name or image'); if (input.data.name) group.name = input.data.name; if (req.file) { const upload = await uploadGroupAvatar(req.file.buffer); if (group.avatarPublicId) await deleteAvatar(group.avatarPublicId).catch(() => {}); group.avatar = upload.secure_url; group.avatarPublicId = upload.public_id } await group.save(); const view = groupView(await populated(Group.findById(group._id))); req.app.get('io')?.to(`group:${group._id}`).emit('group_updated', { group: view }); group.members.forEach(member => req.app.get('io')?.to(`user:${member.id}`).emit('group_updated', { group: view })); res.json({ group: view }) }
export async function setGroupLock(req, res) { const group = await memberGroup(req.params.groupId, req.user._id); requireCreator(group, req.user._id); const input = lockInput.safeParse(req.body); if (!input.success) throw httpError(400, 'locked must be a boolean'); group.locked = input.data.locked; await group.save(); const view = groupView(await populated(Group.findById(group._id))); const io = req.app.get('io'); io?.to(`group:${group._id}`).emit('group_updated', { group: view }); group.members.forEach(member => io?.to(`user:${member.id}`).emit('group_updated', { group: view })); res.json({ group: view }) }
export async function deleteGroup(req, res) { const group = await memberGroup(req.params.groupId, req.user._id); requireCreator(group, req.user._id); if (group.avatarPublicId) await deleteAvatar(group.avatarPublicId).catch(() => {}); await Message.deleteMany({ group: group._id }); await group.deleteOne(); group.members.forEach(member => req.app.get('io')?.to(`user:${member}`).emit('group_deleted', { groupId: group._id.toString() })); res.status(204).end() }
export async function addMembers(req, res) { const group = await memberGroup(req.params.groupId, req.user._id); requireAdmin(group, req.user._id); const input = memberIdsInput.safeParse(req.body); if (!input.success) throw httpError(400, input.error.issues[0].message); const memberIds = await requireFriendMembers(req.user._id, input.data.memberIds); if (memberIds.some(memberId => includes(group.members, memberId))) throw httpError(409, 'A selected user is already a group member'); group.members.push(...memberIds); await group.save(); const view = groupView(await populated(Group.findById(group._id))); const io = req.app.get('io'); memberIds.forEach(memberId => io?.to(`user:${memberId}`).emit('group_added', { group: view })); io?.to(`group:${group._id}`).emit('group_updated', { group: view }); res.json({ group: view }) }
export async function removeMember(req, res) { const group = await memberGroup(req.params.groupId, req.user._id); requireCreator(group, req.user._id); id(req.params.userId); if (req.params.userId === group.creator._id.toString()) throw httpError(400, 'The creator must leave the group instead'); if (!includes(group.members, req.params.userId)) throw httpError(404, 'Member not found'); group.members = group.members.filter(member => member.toString() !== req.params.userId); group.admins = group.admins.filter(admin => admin.toString() !== req.params.userId); await group.save(); const view = groupView(await populated(Group.findById(group._id))); req.app.get('io')?.to(`user:${req.params.userId}`).emit('group_removed', { groupId: group._id.toString() }); req.app.get('io')?.to(`group:${group._id}`).emit('group_updated', { group: view }); res.json({ group: view }) }
export async function addAdmin(req, res) { const group = await memberGroup(req.params.groupId, req.user._id); requireAdmin(group, req.user._id); id(req.params.userId); if (!includes(group.members, req.params.userId)) throw httpError(400, 'Admins must be group members'); if (!includes(group.admins, req.params.userId)) group.admins.push(req.params.userId); await group.save(); res.json({ group: groupView(await populated(Group.findById(group._id))) }) }
export async function removeAdmin(req, res) { const group = await memberGroup(req.params.groupId, req.user._id); requireAdmin(group, req.user._id); id(req.params.userId); if (req.params.userId === group.creator._id.toString()) throw httpError(400, 'The group creator cannot be demoted'); if (!includes(group.admins, req.params.userId)) throw httpError(404, 'Admin not found'); if (group.admins.length === 1) throw httpError(400, 'A group must have an administrator'); group.admins = group.admins.filter(admin => admin.toString() !== req.params.userId); await group.save(); res.json({ group: groupView(await populated(Group.findById(group._id))) }) }
export async function leaveGroup(req, res) { const group = await memberGroup(req.params.groupId, req.user._id); const userId = req.user._id.toString(); group.members = group.members.filter(member => member.toString() !== userId); group.admins = group.admins.filter(admin => admin.toString() !== userId); if (!group.members.length) { await Message.deleteMany({ group: group._id }); await group.deleteOne(); return res.status(204).end() } if (!group.admins.length) group.admins = [group.members[0]]; if (group.creator._id.toString() === userId) group.creator = group.admins[0]; await group.save(); const view = groupView(await populated(Group.findById(group._id))); const io = req.app.get('io'); io?.to(`user:${userId}`).emit('group_removed', { groupId: group._id.toString() }); io?.to(`group:${group._id}`).emit('group_updated', { group: view }); res.json({ group: view }) }
export async function getGroupMessages(req, res) { const group = await memberGroup(req.params.groupId, req.user._id); const messages = await Message.find({ group: group._id }).sort({ createdAt: 1 }).populate([{ path: 'sender', select: '-passwordHash' }, { path: 'replyTo', populate: { path: 'sender', select: '-passwordHash' } }]); res.json({ messages: messages.map(messageView) }) }
export async function createGroupMessage(req, res) {
  const group = await memberGroup(req.params.groupId, req.user._id)
  if (group.locked && !includes(group.admins, req.user._id)) throw httpError(403, 'This group is locked. Only admins can send messages.')
  const text = String(req.body.text || '').trim()
  if (!text || text.length > 5000) throw httpError(400, 'Message text is invalid')

  const message = await Message.create({ group: group._id, sender: req.user._id, text })
  await Group.findByIdAndUpdate(group._id, { lastMessage: message._id, updatedAt: new Date() })
  const view = messageView(await message.populate([{ path: 'sender', select: '-passwordHash' }]))
  const updatedGroup = await populated(Group.findById(group._id))
  const io = req.app.get('io')

  await Promise.all(updatedGroup.members
    .filter(member => member._id.toString() !== req.user._id.toString())
    .map(async (member) => {
      const recipientGroup = groupView(updatedGroup, await unreadCount(updatedGroup._id, member._id))
      io?.to(`user:${member._id}`).emit('group_message_received', { message: view, group: recipientGroup })
      sendMessagePush(member._id, { conversationId: updatedGroup._id.toString(), title: updatedGroup.name, text: view.text, messageId: view.id }).catch(() => {})
    }))

  io?.to(`group:${group._id}`).emit('group_message', { message: view })
  res.status(201).json({ message: view })
}
