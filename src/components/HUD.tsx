import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store'

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function HUD() {
  const { hudVisible, settings, setHudVisible, setSettings } = useAppStore()
  // Placeholders for initial scaffold; wired by Editor via custom events
  const [wpm, setWpm] = useState(0)
  const [chars, setChars] = useState(0)
  const [words, setWords] = useState(0)
  const [typos, setTypos] = useState(0)
  const [focusSeconds, setFocusSeconds] = useState(0)
  const [hiddenByIdle, setHiddenByIdle] = useState(false)
  const idleTimer = useRef<number | null>(null)

  useEffect(() => {
    const onMetrics = (e: Event) => {
      const detail = (e as CustomEvent<any>).detail
      if (!detail) return
      setWpm(detail.wpm ?? wpm)
      setChars(detail.chars ?? chars)
      setWords(detail.words ?? words)
      setTypos(detail.typos ?? typos)
      setFocusSeconds(detail.focusSeconds ?? focusSeconds)
      // peek HUD on activity, then hide after 2s idle
      setHiddenByIdle(false)
      if (idleTimer.current != null) window.clearTimeout(idleTimer.current)
      idleTimer.current = window.setTimeout(() => setHiddenByIdle(true), 2000)
    }
    window.addEventListener('easywrites:metrics', onMetrics as EventListener)
    return () => window.removeEventListener('easywrites:metrics', onMetrics as EventListener)
  }, [wpm, chars, words, typos, focusSeconds])

  // Keep HUD visible while user hovers, prevent reset feeling
  useEffect(() => {
    const onMouseMove = () => setHiddenByIdle(false)
    window.addEventListener('mousemove', onMouseMove)
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [])

  useEffect(() => {
    const onToggle = () => setHudVisible(!hudVisible)
    window.addEventListener('easywrites:hud-toggle', onToggle)
    return () => window.removeEventListener('easywrites:hud-toggle', onToggle)
  }, [hudVisible, setHudVisible])

  const [fontOpen, setFontOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [compact, setCompact] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  // Close when typing resumes
  useEffect(() => {
    const onKey = () => { setFontOpen(false); setColorOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    const update = () => setCompact(window.innerWidth < 820)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return (
    <div className={`hud ${(hudVisible && !hiddenByIdle) ? '' : 'hide'}`} role="status" aria-live="polite">
      <span className="chip" title="Words per minute">WPM: {wpm}</span>
      <span className="chip">Chars: {chars}</span>
      <span className="chip">Words: {words}</span>
      <span className="chip" title="Time on page">Time: {formatTime(focusSeconds)}</span>
      {compact && !showDetails ? (
        <button className="ghost" aria-label="More" onClick={() => setShowDetails(true)}>{'›'}</button>
      ) : (
        <>
          {compact && (
            <button className="ghost" aria-label="Back" onClick={() => setShowDetails(false)}>{'‹'}</button>
          )}
          <span className={`font-pop ${fontOpen ? 'open' : ''}`}>
            <button className="ghost" aria-label="Font selector" onClick={() => setFontOpen(v => !v)}>{settings.font}</button>
            <div className="font-menu">
              <button className="ghost" onClick={() => { setSettings({ font: 'sans' }); setFontOpen(false) }} style={{ fontFamily: 'var(--font-ui)' }}>Sans</button>
              <button className="ghost" onClick={() => { setSettings({ font: 'serif' }); setFontOpen(false) }} style={{ fontFamily: 'var(--font-serif)' }}>Serif</button>
              <button className="ghost" onClick={() => { setSettings({ font: 'mono' }); setFontOpen(false) }} style={{ fontFamily: 'var(--font-mono)' }}>Mono</button>
              <button className="ghost" onClick={() => { setSettings({ font: 'rounded' }); setFontOpen(false) }} style={{ fontFamily: 'var(--font-rounded)' }}>Rounded</button>
              <button className="ghost" onClick={() => { setSettings({ font: 'slab' }); setFontOpen(false) }} style={{ fontFamily: 'var(--font-slab)' }}>Slab</button>
            </div>
          </span>
          <span className="quick">
            <button className="ghost" aria-label="Decrease font" onClick={() => setSettings({ size: Math.max(12, Math.round(settings.size - 1)) })}>A−</button>
            <button className="ghost" aria-label="Increase font" onClick={() => setSettings({ size: Math.min(28, Math.round(settings.size + 1)) })}>A＋</button>
            <span className={`color-pop ${colorOpen ? 'open' : ''}`}>
              <button className="ghost color-trigger" aria-label="Text color" onClick={() => setColorOpen(v => !v)}>
                <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" fill="url(#grad)" stroke="currentColor" strokeWidth="1.2"/><defs><linearGradient id="grad" x1="4" y1="4" x2="20" y2="20"><stop offset="0" stopColor="#6EE7F2"/><stop offset="1" stopColor="#9B87F5"/></linearGradient></defs></svg>
              </button>
              <div className="palette rows">
                <div className="row">
                  <button className="ghost" onClick={() => { setSettings({ gradient: 'brand' }); setColorOpen(false) }} style={{ background: 'linear-gradient(90deg, var(--brand), var(--accent))' }} aria-label="Brand gradient"></button>
                  <button className="ghost" onClick={() => { setSettings({ gradient: 'sunset' }); setColorOpen(false) }} style={{ background: 'linear-gradient(90deg, #F59E0B, #F97066)' }} aria-label="Sunset gradient"></button>
                  <button className="ghost" onClick={() => { setSettings({ gradient: 'sea' }); setColorOpen(false) }} style={{ background: 'linear-gradient(90deg, #6EE7F2, #22C55E)' }} aria-label="Sea gradient"></button>
                  <button className="ghost" onClick={() => { setSettings({ gradient: 'aurora' }); setColorOpen(false) }} style={{ background: 'linear-gradient(90deg, #8b5cf6, #06b6d4, #22c55e)' }} aria-label="Aurora gradient"></button>
                  <button className="ghost" onClick={() => { setSettings({ gradient: 'fire' }); setColorOpen(false) }} style={{ background: 'linear-gradient(90deg, #F97316, #EF4444)' }} aria-label="Fire gradient"></button>
                  <button className="ghost" onClick={() => { setSettings({ gradient: 'ocean' }); setColorOpen(false) }} style={{ background: 'linear-gradient(90deg, #38bdf8, #14b8a6)' }} aria-label="Ocean gradient"></button>
                  <button className="ghost" onClick={() => { setSettings({ gradient: 'sunrise' }); setColorOpen(false) }} style={{ background: 'linear-gradient(90deg, #fde047, #fb7185)' }} aria-label="Sunrise gradient"></button>
                </div>
                <div className="row">
                  {/* Solid palette is filtered by theme in runtime */}
                  <ThemeAwareSwatches />
                  <button className="ghost" onClick={() => setSettings({ gradient: '', color: '#9AA4B2' })} style={{ background: '#9AA4B2' }} aria-label="Muted"></button>
                  <button className="ghost" onClick={() => setSettings({ gradient: '', color: '#22C55E' })} style={{ background: '#22C55E' }} aria-label="Green"></button>
                  <button className="ghost" onClick={() => setSettings({ gradient: '', color: '#F59E0B' })} style={{ background: '#F59E0B' }} aria-label="Amber"></button>
                  <button className="ghost" onClick={() => setSettings({ gradient: '', color: '#F97066' })} style={{ background: '#F97066' }} aria-label="Coral"></button>
                  <button className="ghost" onClick={() => setSettings({ gradient: '', color: '#60A5FA' })} style={{ background: '#60A5FA' }} aria-label="Blue"></button>
                  <button className="ghost" onClick={() => setSettings({ gradient: '', color: '#a78bfa' })} style={{ background: '#a78bfa' }} aria-label="Violet"></button>
                </div>
              </div>
            </span>
          </span>
        </>
      )}
    </div>
  )
}

function ThemeAwareSwatches() {
  const { settings, setSettings } = useAppStore()
  if (settings.theme === 'dark') {
    return (
      <>
        <button className="ghost" onClick={() => setSettings({ gradient: '', color: '#E6E6E6' })} style={{ background: '#E6E6E6' }} aria-label="Light" />
      </>
    )
  }
  return (
    <>
      <button className="ghost" onClick={() => setSettings({ gradient: '', color: '#111827' })} style={{ background: '#111827' }} aria-label="Ink" />
    </>
  )
}


