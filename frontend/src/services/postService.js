import api from './api'

export const postService = {
  async feed({ page = 1 } = {}) { const { data } = await api.get('/posts/feed', { params: { page, limit: 12 } }); return data },
  async listUser(userId, { page = 1, tab = 'posts' } = {}) {
    const { data } = await api.get(`/posts/user/${userId}`, { params: { page, tab, limit: 12 } })
    return data
  },
  async create({ media = [], caption }) {
    const form = new FormData()
    for (const image of Array.isArray(media) ? media : media ? [media] : []) form.append('media', image)
    form.append('caption', caption || '')
    const { data } = await api.post('/posts', form)
    return data.post
  },
  async get(postId) { const { data } = await api.get(`/posts/${postId}`); return data.post },
  async view(postId) { const { data } = await api.post(`/posts/${postId}/view`); return data.post },
  async remove(postId) { await api.delete(`/posts/${postId}`) },
  async like(postId) { const { data } = await api.post(`/posts/${postId}/like`); return data.post },
  async unlike(postId) { const { data } = await api.delete(`/posts/${postId}/like`); return data.post },
  async likes(postId, page = 1) { const { data } = await api.get(`/posts/${postId}/likes`, { params: { page, limit: 20 } }); return data },
  async comments(postId, page = 1) { const { data } = await api.get(`/posts/${postId}/comments`, { params: { page, limit: 30 } }); return data },
  async addComment(postId, text) { const { data } = await api.post(`/posts/${postId}/comments`, { text }); return data },
  async removeComment(postId, commentId) { await api.delete(`/posts/${postId}/comments/${commentId}`) },
}
