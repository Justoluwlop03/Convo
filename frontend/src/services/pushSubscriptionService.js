import api from './api'

function vapidKeyToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') return false
  const { data: configuration } = await api.get('/users/push-configuration')
  if (!configuration.enabled || !configuration.publicKey) return false
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyToUint8Array(configuration.publicKey) })
  await api.post('/users/push-subscriptions', subscription.toJSON())
  return true
}
