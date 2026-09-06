import api from '../lib/api';

// Admin/self settings that don't already have a dedicated client.
// - Company profile reuses the website site_settings store (websiteAdminApi.settings).
// - Assignment rules reuse smartAssignmentApi.getSettings/updateSettings.
// - Below: per-user notification channels and self-service password change.

export interface NotificationSettings {
  id?: number;
  userId?: number;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  inAppEnabled: boolean;
}

export const settingsApi = {
  getNotificationSettings: () =>
    api.get<NotificationSettings>('/notifications/settings').then((r) => r.data),

  updateNotificationSettings: (settings: NotificationSettings) =>
    api.put<NotificationSettings>('/notifications/settings', settings).then((r) => r.data),

  /** Change the signed-in user's own password (verifies the current one server-side). */
  changeOwnPassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),
};
