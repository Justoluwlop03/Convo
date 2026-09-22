export function supportsNotifications() {
  return typeof Notification !== 'undefined'
}

export function canRequestNotificationPermission() {
  return supportsNotifications() && Notification.permission === 'default'
}

export async function requestNotificationPermission() {
  if (!supportsNotifications()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission !== 'default') return false
  return (await Notification.requestPermission()) === 'granted'
}

export async function showUnreadMessageNotification({ title, body, messageId }) {
  // The conversation is already visible, so alerting again would be noisy and
  // would duplicate an in-app message the user has effectively read.
  if (!supportsNotifications() || Notification.permission !== 'granted' || document.visibilityState === 'visible') return

  const options = {
    body,
    tag: `convo-message-${messageId}`,
    renotify: false,
  }

  try {
    const registration = await navigator.serviceWorker?.ready
    // A stored subscription means the service worker will receive the same
    // event from the server. Let that single background path show the alert.
    if (registration) {
      if (!registration.pushManager) return registration.showNotification(title, options)
      if (await registration.pushManager.getSubscription()) return
      return registration.showNotification(title, options)
    }
    new Notification(title, options)
  } catch (error) {
    console.warn('Unable to show the local message notification', error)
    // Notifications are an enhancement; unread state and the app badge remain
    // the reliable fallback if the platform declines to display one.
  }
}
