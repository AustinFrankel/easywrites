import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: auto update and offline-first (load virtual module dynamically to avoid dev errors)
// In dev, the virtual module exists; wrap in try/catch for safety in edge cases
try {
  // @ts-ignore
  if ('serviceWorker' in navigator) {
    // @ts-ignore
    import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
  }
} catch {}
