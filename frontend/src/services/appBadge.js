export function supportsAppBadges() {
  return typeof navigator !== 'undefined' && typeof navigator.setAppBadge === 'function'
}

export function canRequestAppBadgePermission() {
  return supportsAppBadges() && typeof Notification !== 'undefined' && Notification.permission === 'default'
}

export async function requestAppBadgePermission() {
  if (!supportsAppBadges() || typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission !== 'default') return false
  return (await Notification.requestPermission()) === 'granted'
}

export function syncAppBadge(unreadCount) {
  const count = Math.max(0, Number(unreadCount) || 0)

  // The operating system controls how large values are rendered (commonly
  // `99+`). Unlike the in-app badge, the Web Badging API accepts a number.
  if (count > 0 && supportsAppBadges()) {
    navigator.setAppBadge(count).catch(() => {})
  } else if (count === 0 && typeof navigator !== 'undefined' && typeof navigator.clearAppBadge === 'function') {
    navigator.clearAppBadge().catch(() => {})
  }
}
