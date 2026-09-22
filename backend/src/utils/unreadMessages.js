// `read` is retained for legacy messages. New messages use `readBy` so a read
// receipt belongs to the member who read it rather than every group member.
export function unreadMessageFilter(userId, conversation) {
  return {
    ...conversation,
    sender: { $ne: userId },
    $or: [
      { readBy: { $exists: true, $ne: userId } },
      { readBy: { $exists: false }, read: false },
    ],
  }
}

export function unreadMessageCondition(userId) {
  return {
    sender: { $ne: userId },
    $or: [
      { readBy: { $exists: true, $ne: userId } },
      { readBy: { $exists: false }, read: false },
    ],
  }
}
