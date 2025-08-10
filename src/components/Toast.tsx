import { useEffect, useState } from 'react'

export function Toast() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    const onToast = (e: Event) => {
      const { message } = (e as CustomEvent<{ message: string }>).detail
      setMsg(message)
      window.setTimeout(() => setMsg(null), 1500)
    }
    window.addEventListener('easywrites:toast', onToast as EventListener)
    return () => window.removeEventListener('easywrites:toast', onToast as EventListener)
  }, [])
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', background: 'var(--panel)', color: 'var(--ink)', padding: '8px 12px', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.3)' }}>
      {msg}
    </div>
  )
}


