import { useEffect } from 'react'
import { useAppStore } from './store'
import { applyTheme } from './theme'

export function useGlobalShortcuts() {
  const { settings, setSettings } = useAppStore()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      switch (e.key.toLowerCase()) {
        case 's': {
          e.preventDefault()
          // Manual save toast placeholder
          window.dispatchEvent(new CustomEvent('easywrites:toast', { detail: { message: 'Saved' } }))
          break
        }
        case 'k': {
          e.preventDefault()
          setSettings({ focus: !settings.focus })
          break
        }
        case '/': {
          e.preventDefault()
          // Toggle HUD visibility
          // Will be wired to store if needed; using event for now
          const evt = new CustomEvent('easywrites:hud-toggle')
          window.dispatchEvent(evt)
          break
        }
        case 'l': {
          e.preventDefault()
          const next = settings.theme === 'dark' ? 'light' : 'dark'
          setSettings({ theme: next })
          applyTheme(next)
          break
        }
        case '=':
        case '+': {
          e.preventDefault()
          setSettings({ size: Math.min(settings.size + 1, 22) })
          break
        }
        case '-': {
          e.preventDefault()
          setSettings({ size: Math.max(settings.size - 1, 12) })
          break
        }
        case 'e': {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('easywrites:export'))
          break
        }
        case 'p': {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('easywrites:playback'))
          break
        }
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settings, setSettings])
}


