import webpush from 'web-push'
import PushSubscription from '../models/PushSubscription.js'
import User from '../models/User.js'
import { unreadTotalFor } from './unreadTotal.js'

function configured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT)
}

function configure() {
  if (configured()) webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
}

export function pushConfiguration() {
  return { enabled: configured(), publicKey: configured() ? process.env.VAPID_PUBLIC_KEY : null }
}

export async function sendMessagePush(userId, { conversationId, title, text, messageId }) {
  if (!configured()) return
  const user = await User.findById(userId).select('notificationSettings')
  const settings = user?.notificationSettings
  if (!user || settings?.alertsEnabled === false || settings?.mutedConversationIds?.some(id => id.toString() === conversationId)) return
  configure()
  const payload = JSON.stringify({
    conversationId,
    title,
    body: settings?.showPreview === false ? 'You have a new message' : text,
    showPreview: settings?.showPreview !== false,
    messageId,
    unreadCount: await unreadTotalFor(userId),
  })
  const subscriptions = await PushSubscription.find({ user: userId })
  await Promise.all(subscriptions.map(async subscription => {
    try { await webpush.sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, payload) }
    catch (error) { if (error.statusCode === 404 || error.statusCode === 410) await subscription.deleteOne() }
  }))
}
