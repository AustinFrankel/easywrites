import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store'
import { applyTheme } from '../theme'

export function TopBar() {
  const { currentId, updateTitle, createDoc, settings, setSettings } = useAppStore()
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      if (!currentId) {
        await createDoc()
      }
    })()
  }, [currentId, createDoc])

  useEffect(() => {
    const onTitle = (e: Event) => {
      const { title: t } = (e as CustomEvent<{ id: string; title: string }>).detail
      setTitle(t)
    }
    window.addEventListener('easywrites:title', onTitle as EventListener)
    return () => window.removeEventListener('easywrites:title', onTitle as EventListener)
  }, [])

  const onEnterNew = async () => {
    // Reset settings and create a fresh doc
    setSettings({ font: 'sans', size: 18, color: getComputedStyle(document.documentElement).getPropertyValue('--text-default')?.trim() || '#111827', gradient: '', focus: false, spell: true })
    await createDoc()
    inputRef.current?.focus()
  }

  const toggleTheme = () => {
    const next = settings.theme === 'dark' ? 'light' : 'dark'
    setSettings({ theme: next })
    applyTheme(next)
    // Return focus to editor so typing continues
    window.setTimeout(() => {
      const el = document.querySelector('.editor-input') as HTMLElement | null
      el?.focus()
    }, 0)
  }

  return (
    <div className="topbar" aria-label="Top bar">
      <button onClick={onEnterNew} aria-label="New document" style={{ background: 'transparent', border: 'none', color: 'var(--ink)', fontWeight: 600, fontSize: 16 }}>
        Easy Writes
      </button>
      <input
        ref={inputRef}
        className="inline-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => updateTitle(title)}
        placeholder="Untitled"
        aria-label="Document title"
        style={{
          borderRadius: 12,
          background: 'color-mix(in oklab, var(--panel) 60%, transparent)',
          padding: '6px 10px',
          fontSize: 14,
          transition: 'background 150ms ease',
          textAlign: 'center',
          minWidth: 200,
        }}
        onFocus={(e) => (e.currentTarget.style.background = 'color-mix(in oklab, var(--panel) 75%, transparent)')}
        onBlurCapture={(e) => (e.currentTarget.style.background = 'color-mix(in oklab, var(--panel) 60%, transparent)')}
      />
      <div style={{ display: 'flex', gap: 10 }} className="topbar-actions">
        <button className="ghost" onClick={toggleTheme} aria-label="Toggle theme" style={{ fontSize: 15 }}>{settings.theme === 'dark' ? 'Dark' : 'Light'}</button>
        <button className="ghost" aria-label="Open playback" onClick={() => window.dispatchEvent(new CustomEvent('easywrites:playback'))}>Playback</button>
        <button className="ghost" aria-label="Share" onClick={() => window.dispatchEvent(new CustomEvent('easywrites:export'))}>Share</button>
      </div>
    </div>
  )
}


