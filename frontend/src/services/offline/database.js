const DATABASE_NAME = 'convo-offline'
const DATABASE_VERSION = 2
const STORES = ['conversations', 'messages', 'outbox', 'profiles']

function keyFor(userId, id) {
  return `${userId}:${id}`
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is unavailable'))
      return
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      STORES.forEach((store) => {
        if (!database.objectStoreNames.contains(store)) database.createObjectStore(store, { keyPath: 'key' })
      })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function put(storeName, record) {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(record)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

async function get(storeName, key) {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function recordsForUser(storeName, userId) {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll()
    request.onsuccess = () => resolve(request.result.filter((record) => record.userId === userId))
    request.onerror = () => reject(request.error)
  })
}

export async function saveConversations(userId, conversations) {
  await put('conversations', { key: keyFor(userId, 'recent'), userId, conversations, updatedAt: Date.now() })
}

export async function loadConversations(userId) {
  return (await get('conversations', keyFor(userId, 'recent')))?.conversations || []
}

export async function saveMessages(userId, chatId, messages) {
  await put('messages', { key: keyFor(userId, chatId), userId, chatId, messages, updatedAt: Date.now() })
}

export async function loadMessages(userId, chatId) {
  return (await get('messages', keyFor(userId, chatId)))?.messages || []
}

export async function queueMessage(userId, message) {
  await put('outbox', { key: keyFor(userId, message.id), userId, ...message, queuedAt: Date.now() })
}

export async function getQueuedMessages(userId) {
  return (await recordsForUser('outbox', userId)).sort((a, b) => a.queuedAt - b.queuedAt)
}

export async function removeQueuedMessage(userId, messageId) {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('outbox', 'readwrite')
    transaction.objectStore('outbox').delete(keyFor(userId, messageId))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

export async function clearOfflineData(userId) {
  const database = await openDatabase()
  await Promise.all(STORES.map(async (storeName) => {
    const records = await recordsForUser(storeName, userId)
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      records.forEach((record) => store.delete(record.key))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }))
}

export async function saveOfflineProfile(user) {
  const profile = { id: user.id, username: user.username, email: user.email, avatar: user.avatar }
  await put('profiles', { key: 'active', userId: user.id, profile })
}

export async function loadOfflineProfile() {
  return (await get('profiles', 'active'))?.profile || null
}

export async function clearOfflineProfile() {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('profiles', 'readwrite')
    transaction.objectStore('profiles').delete('active')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}
