import api from './api'

export const notificationSettingsService = {
  async get() {
    const { data } = await api.get('/users/notification-settings')
    return data.settings
  },
  async update(settings) {
    const { data } = await api.patch('/users/notification-settings', settings)
    return data.settings
  },
}
