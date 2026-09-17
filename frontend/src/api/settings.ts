import { apiFetch } from './client'
import type { UserSettings, SettingsUpdatePayload } from './types'

export const settingsApi = {
  get: () => apiFetch<UserSettings>('/api/settings'),
  update: (data: SettingsUpdatePayload) =>
    apiFetch<UserSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
}
