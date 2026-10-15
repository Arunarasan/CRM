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
}

// Admin backups are streamed to the browser and saved on the admin's own computer (nothing kept on the server).
export const backupApi = {
  info: () => api.get<BackupInfo>('/admin/backup/info').then((r) => r.data),
  download: async (kind: 'database' | 'files', onProgress?: (bytes: number) => void) => {
    const res = await api.get<Blob>(`/admin/backup/${kind}`, {
      responseType: 'blob',
      timeout: 0,
      onDownloadProgress: (e) => onProgress?.(e.loaded),
    });
    const cd: string = res.headers['content-disposition'] || '';
    const name = /filename="?([^";]+)"?/.exec(cd)?.[1] || `arudra-crm-${kind}-backup`;
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return name;
  },
};
