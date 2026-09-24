import bcrypt from 'bcryptjs'
import { z } from 'zod'
import User from '../models/User.js'
import { generateToken } from '../utils/generateToken.js'
import { httpError } from '../middleware/errorMiddleware.js'
import { deleteAvatar, uploadAvatar } from '../config/cloudinary.js'

const credentials = z.object({
  // Mongoose normalizes stored addresses to lowercase. Normalize the login
  // input too, so an address entered with capital letters still matches.
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
})
const registration = credentials.extend({ username: z.string().trim().min(2).max(30) })
const profileUpdate = z.object({
  username: z.string().trim().min(2).max(30).optional(),
  displayName: z.string().trim().max(50).optional(),
  bio: z.string().trim().max(160).optional(),
  about: z.string().trim().max(1000).optional(),
})

function parse(schema, data) {
  const result = schema.safeParse(data)
  if (!result.success) throw httpError(400, result.error.issues[0].message)
  return result.data
}

function authResponse(user) {
  return { user: user.toPublicJSON(), token: generateToken(user._id) }
}

export async function register(req, res) {
  const input = parse(registration, req.body)
  const [emailExists, usernameExists] = await Promise.all([User.exists({ email: input.email }), User.exists({ username: input.username })])
  if (emailExists) throw httpError(409, 'Email is already registered')
  if (usernameExists) throw httpError(409, 'Username is already taken')
  const user = await User.create({ ...input, passwordHash: await bcrypt.hash(input.password, 12), isOnline: true })
  res.status(201).json(authResponse(user))
}

export async function login(req, res) {
  const input = parse(credentials, req.body)
  const user = await User.findOne({ email: input.email }).select('+passwordHash')
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) throw httpError(401, 'Invalid email or password')
  user.isOnline = true
  await user.save()
  res.json(authResponse(user))
}

export async function me(req, res) {
  res.json({ user: req.user.toPublicJSON() })
}

export async function updateProfile(req, res) {
  const input = parse(profileUpdate, req.body)
  if (input.username && input.username !== req.user.username) {
    const usernameExists = await User.exists({ username: input.username, _id: { $ne: req.user._id } })
    if (usernameExists) throw httpError(409, 'Username is already taken')
    req.user.username = input.username
  }
  if (input.bio !== undefined) req.user.bio = input.bio
  if (input.displayName !== undefined) req.user.displayName = input.displayName
  if (input.about !== undefined) req.user.about = input.about
  await req.user.save()
  res.json({ user: req.user.toPublicJSON() })
}

export async function updateAvatar(req, res) {
  if (!req.file) throw httpError(400, 'An image file is required')

  const previousAvatarPublicId = req.user.avatarPublicId
  const result = await uploadAvatar(req.file.buffer)
  req.user.avatar = result.secure_url
  req.user.avatarPublicId = result.public_id
  await req.user.save()
  if (previousAvatarPublicId) await deleteAvatar(previousAvatarPublicId)
  res.json({ user: req.user.toPublicJSON() })
}

export async function deleteAvatarImage(req, res) {
  if (req.user.avatarPublicId) await deleteAvatar(req.user.avatarPublicId)
  req.user.avatar = ''
  req.user.avatarPublicId = ''
  await req.user.save()
  res.json({ user: req.user.toPublicJSON() })
}
