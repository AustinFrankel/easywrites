import { useEffect, useState } from 'react'

export function Onboarding() {
  const [show, setShow] = useState(() => localStorage.getItem('ew-onboarded') !== '1')
  useEffect(() => {
    const onFirstKey = () => {
      localStorage.setItem('ew-onboarded', '1')
      setShow(false)
      window.removeEventListener('keydown', onFirstKey)
    }
    if (show) window.addEventListener('keydown', onFirstKey, { once: true })
    return () => window.removeEventListener('keydown', onFirstKey)
  }, [show])
  if (!show) return null
  return (
    <div style={{ position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', background: 'var(--panel)', color: 'var(--ink)', padding: '8px 12px', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.3)', display: 'flex', gap: 8 }}>
      <span>Start typing</span>
      <span>•</span>
      <span>⌘K Focus</span>
      <span>•</span>
      <span>⌘P Playback</span>
    </div>
  )
}


