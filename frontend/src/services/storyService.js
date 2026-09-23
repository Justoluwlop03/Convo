import api from './api'

export const storyService = {
  async list() { const { data } = await api.get('/stories'); return data.stories },
  async get(storyId) { const { data } = await api.get(`/stories/${storyId}`); return data.story },
  async create({ media, caption, visibility }) { const form = new FormData(); form.append('media', media); form.append('caption', caption); form.append('visibility', visibility); const { data } = await api.post('/stories', form); return data.story },
  async remove(storyId) { await api.delete(`/stories/${storyId}`) },
  async markViewed(storyId) { await api.post(`/stories/${storyId}/views`) },
  async react(storyId, emoji) { const { data } = await api.put(`/stories/${storyId}/reaction`, { emoji }); return data.reactions },
  async reply(storyId, text) { const { data } = await api.post(`/stories/${storyId}/reply`, { text }); return data },
  async viewers(storyId) { const { data } = await api.get(`/stories/${storyId}/views`); return data.viewers },
}
