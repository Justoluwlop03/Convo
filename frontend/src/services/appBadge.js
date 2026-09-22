export function syncAppBadge(unreadCount) {
  const count = Math.max(0, Number(unreadCount) || 0)

  // The operating system controls how large values are rendered (commonly
  // `99+`). Unlike the in-app badge, the Web Badging API accepts a number.
  if (count > 0 && typeof navigator.setAppBadge === 'function') {
    navigator.setAppBadge(count).catch(() => {})
  } else if (count === 0 && typeof navigator.clearAppBadge === 'function') {
    navigator.clearAppBadge().catch(() => {})
  }
}
