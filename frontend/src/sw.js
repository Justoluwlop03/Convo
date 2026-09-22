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

self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data?.json() || {} } catch { payload = { body: event.data?.text() } }
  const unreadCount = Math.max(0, Number(payload.unreadCount) || 0)
  const conversationId = payload.conversationId || ''
  const notification = self.registration.showNotification(payload.title || 'New message in Convo', {
    body: payload.showPreview === false ? 'You have a new message' : (payload.body || 'You have a new message'),
    tag: payload.messageId ? `convo-message-${payload.messageId}` : undefined,
    data: { conversationId },
    renotify: false,
  })
  const badge = typeof self.navigator.setAppBadge === 'function'
    ? (unreadCount ? self.navigator.setAppBadge(unreadCount) : self.navigator.clearAppBadge())
    : Promise.resolve()
  event.waitUntil(Promise.all([notification, badge]))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const conversationId = event.notification.data?.conversationId
  const destination = new URL('/', self.location.origin)
  if (conversationId) destination.searchParams.set('chat', conversationId)
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const client = windows[0]
    if (client) return client.focus().then(() => client.postMessage({ type: 'OPEN_CONVERSATION', conversationId }))
    return self.clients.openWindow(destination.href)
  }))
})
