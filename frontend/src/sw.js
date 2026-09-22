import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { createHandlerBoundToURL } from 'workbox-precaching'
import { NetworkOnly } from 'workbox-strategies'

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly())

// Push events can arrive in a burst. Chaining the display work gives every
// event its own waitUntil promise while avoiding races between notification and
// badge updates. A failed event is logged and does not stop later events.
let notificationQueue = Promise.resolve()

function parsePushPayload(event) {
  try {
    const payload = event.data?.json()
    return payload && typeof payload === 'object' ? payload : {}
  } catch (error) {
    console.warn('Received a malformed Convo push payload', error)
    try { return { body: event.data?.text() || '' } } catch { return {} }
  }
}

function showPushNotification(payload) {
  const unreadCount = Math.max(0, Number(payload.unreadCount) || 0)
  const conversationId = payload.conversationId || ''
  const destination = typeof payload.destination === 'string' && payload.destination.startsWith('/') ? payload.destination : '/'
  const messageId = typeof payload.messageId === 'string' && payload.messageId ? payload.messageId : crypto.randomUUID()
  return Promise.all([
    self.registration.showNotification(payload.title || 'New message in Convo', {
      body: payload.showPreview === false ? (payload.privateBody || 'You have a new notification') : (payload.body || 'You have a new notification'),
      icon: '/icons/convo-icon-192.png',
      badge: '/icons/convo-icon-192.png',
      tag: `message-${messageId}`,
      data: { conversationId, messageId, destination },
      renotify: false,
    }),
    typeof self.navigator.setAppBadge === 'function'
      ? (unreadCount ? self.navigator.setAppBadge(unreadCount) : self.navigator.clearAppBadge())
      : Promise.resolve(),
  ])
}

self.addEventListener('push', (event) => {
  const payload = parsePushPayload(event)
  const task = notificationQueue.then(() => showPushNotification(payload))
  notificationQueue = task.catch(error => console.error('Unable to display a Convo push notification', error))
  event.waitUntil(task)
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const conversationId = event.notification.data?.conversationId
  const destination = new URL(event.notification.data?.destination || '/', self.location.origin)
  if (conversationId) destination.searchParams.set('chat', conversationId)
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const client = windows[0]
    if (client && conversationId) return client.focus().then(() => client.postMessage({ type: 'OPEN_CONVERSATION', conversationId }))
    if (client) return client.navigate(destination.href).then(windowClient => windowClient?.focus())
    return self.clients.openWindow(destination.href)
  }))
})
