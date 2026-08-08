// Lightweight client-side theme + preference storage for the employee portal Settings.
// Dark mode is applied by toggling the `dark` class on <html> (Tailwind darkMode: "class").
// Language + notification preferences are stored locally (no i18n / push backend yet), so the
// Settings screen can persist the user's choices even though only dark mode changes the UI today.

export type Theme = 'light' | 'dark';

const THEME_KEY = 'portalTheme';
const LANG_KEY = 'portalLang';
const NOTIF_KEY = 'portalNotifPrefs';

export function getTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

/** Apply the saved theme on app boot so dark mode survives reloads. */
export function initTheme(): void {
  applyTheme(getTheme());
}

export function getLanguage(): string {
  return localStorage.getItem(LANG_KEY) || 'en';
}

export function setLanguage(lang: string): void {
  localStorage.setItem(LANG_KEY, lang);
}

export type NotifPrefs = Record<string, boolean>;

export const NOTIF_DEFAULTS: NotifPrefs = {
  newTask: true,
  materialApproved: true,
  manpowerApproved: true,
  attendanceReminder: true,
  projectUpdate: true,
};

export function getNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    return raw ? { ...NOTIF_DEFAULTS, ...JSON.parse(raw) } : { ...NOTIF_DEFAULTS };
  } catch {
    return { ...NOTIF_DEFAULTS };
  }
}

export function setNotifPrefs(prefs: NotifPrefs): void {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
}
