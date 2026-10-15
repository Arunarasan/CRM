/** Registers the service worker that lets the app open with no connection (production builds only). */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL; // '/crm/' in production
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      /* offline start-up is a nice-to-have; the app works normally without it */
    });
  });
}
