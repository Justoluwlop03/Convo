import webpush from 'web-push'
import PushSubscription from '../models/PushSubscription.js'
import User from '../models/User.js'
import { unreadTotalFor } from './unreadTotal.js'

function vapidSubject() {
  const configuredSubject = process.env.VAPID_SUBJECT || process.env.VAPID_EMAIL
  if (!configuredSubject) return null
  return configuredSubject.includes(':') ? configuredSubject : `mailto:${configuredSubject}`
}

function configured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && vapidSubject())
}

function configure() {
  if (configured()) webpush.setVapidDetails(vapidSubject(), process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
}

export function pushConfiguration() {
  return { enabled: configured(), publicKey: configured() ? process.env.VAPID_PUBLIC_KEY : null }
}

async function sendPush(userId, { title, text, privateText = 'You have a new notification', notificationId, conversationId = '', destination = '/', muteConversation = false }) {
  try {
    if (!configured()) {
      console.warn('Web Push is skipped because VAPID is not configured')
      return
    }
    const user = await User.findById(userId).select('notificationSettings')
    const settings = user?.notificationSettings
    if (!user || settings?.alertsEnabled === false || (muteConversation && settings?.mutedConversationIds?.some(id => id.toString() === conversationId))) return
    configure()
    const payload = JSON.stringify({
      conversationId,
      title,
      body: settings?.showPreview === false ? privateText : text,
      privateBody: privateText,
      showPreview: settings?.showPreview !== false,
      messageId: notificationId,
      destination,
      unreadCount: await unreadTotalFor(userId),
    })
    const subscriptions = await PushSubscription.find({ user: userId })
    if (!subscriptions.length) {
      return
    }
    await Promise.all(subscriptions.map(async subscription => {
      try {
        // Keep each message independent. There is intentionally no debounce,
        // shared "already notified" flag, or notification payload reuse here.
        console.info('Web Push delivery attempt', { notificationId })
        const response = await webpush.sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, payload)
        console.info('Web Push delivery succeeded', { notificationId, statusCode: response.statusCode })
      }
      catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await subscription.deleteOne()
          console.info('Removed an expired Web Push subscription', { notificationId })
          return
        }
        console.error('Web Push delivery failed', { notificationId, statusCode: error.statusCode, message: error.message })
      }
    }))
  } catch (error) {
    console.error('Web Push preparation failed', { message: error.message })
  }
}

export function sendMessagePush(userId, { conversationId, title, text, messageId }) {
  return sendPush(userId, { title, text, privateText: 'You have a new message', notificationId: messageId, conversationId, muteConversation: true })
}

export function sendFriendPush(userId, { title, text, privateText = 'You have a friend update', notificationId, destination = '/' }) {
  return sendPush(userId, { title, text, privateText, notificationId, destination })
}
