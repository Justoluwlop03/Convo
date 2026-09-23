import { z } from 'zod'
import PushSubscription from '../models/PushSubscription.js'
import { httpError } from '../middleware/errorMiddleware.js'
import { pushConfiguration } from '../utils/pushNotifications.js'

const subscriptionInput = z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }) })

export function getPushConfiguration(req, res) { res.json(pushConfiguration()) }

export async function savePushSubscription(req, res) {
  const input = subscriptionInput.safeParse(req.body)
  if (!input.success) throw httpError(400, 'Invalid push subscription')
  await PushSubscription.findOneAndUpdate({ endpoint: input.data.endpoint }, { user: req.user._id, ...input.data }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true })
  res.status(201).json({ ok: true })
}

export async function deletePushSubscription(req, res) {
  const endpoint = String(req.body?.endpoint || '')
  if (!endpoint) throw httpError(400, 'Subscription endpoint is required')
  await PushSubscription.deleteOne({ user: req.user._id, endpoint })
  res.status(204).end()
}
