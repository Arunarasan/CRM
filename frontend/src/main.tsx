import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initTheme } from './lib/theme'
import { I18nProvider } from './i18n'

initTheme()

// App-wide: focusing a number box that holds just "0" selects it, so typing replaces the 0
// instead of producing "05". Covers plain <input type="number"> too, not only the shared Input.
document.addEventListener('focusin', (e) => {
  const el = e.target
  if (el instanceof HTMLInputElement && el.type === 'number' && Number(el.value) === 0 && el.value !== '') {
    el.select()
    // A mouse click would place the caret after focus and undo the selection — swallow that mouseup.
    el.addEventListener('mouseup', (ev) => ev.preventDefault(), { once: true })
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
