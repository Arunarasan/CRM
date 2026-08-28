import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SiteSettingsProvider } from './hooks/useSiteSettings'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <SiteSettingsProvider>
          <App />
        </SiteSettingsProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
