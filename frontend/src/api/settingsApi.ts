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

export interface BackupInfo {
  tables: number;
  approxRows: number;
  storageType: string;
  filesIncluded: boolean;
  fileCount: number;
  fileBytes: number;
  bucketError?: boolean;
}

// Admin backups are streamed to the browser and saved on the admin's own computer (nothing kept on the server).
// An admin-only call returns a short-lived ticket; the browser then downloads the link natively, straight
// to disk, so even a multi-GB files backup never has to fit in the page's memory.
export const backupApi = {
  info: () => api.get<BackupInfo>('/admin/backup/info').then((r) => r.data),
  startDownload: async (kind: 'database' | 'files') => {
    const { ticket } = await api.post<{ ticket: string }>('/admin/backup/ticket', null, { params: { kind } }).then((r) => r.data);
    const base = String(api.defaults.baseURL || '/api').replace(/\/$/, '');
    const a = document.createElement('a');
    a.href = `${base}/admin/backup/download/${kind}?ticket=${encodeURIComponent(ticket)}`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
};
