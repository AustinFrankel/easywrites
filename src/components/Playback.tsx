import { useEffect, useRef, useState } from 'react'
import { ksWorker } from '../editor/ks'

type KS = { t: number; op: 'ins'|'del'; ch?: string; from: number; to: number }

export function Playback() {
  const [open, setOpen] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [events, setEvents] = useState<KS[]>([])
  const [playing, setPlaying] = useState(false)
  const [speed] = useState(1)
  const [progress, setProgress] = useState(0)
  // scrubbing disabled
  const [elapsedSec, setElapsedSec] = useState(0)
  useEffect(() => {
    const onKey = () => {}
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const textBuffer = useRef('')
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('easywrites:playback', onOpen)
    return () => window.removeEventListener('easywrites:playback', onOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    const onMsg = (e: MessageEvent<{ type: string; payload?: KS[] }>) => {
      const data: any = (e as unknown as MessageEvent).data
      if (data?.type === 'dump') setEvents((data.payload || []) as KS[])
    }
    ;(ksWorker as any).onmessage = onMsg
    ksWorker.postMessage({ type: 'dump' })
    return () => { (ksWorker as any).onmessage = null }
  }, [open])

  // Helper: draw frame for a given progress [0..1]
  const drawAt = (p: number) => {
    if (!open || events.length === 0) return
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    const total = events[events.length - 1].t - events[0].t
    const elapsed = Math.max(0, Math.min(total, total * p))
    const tCut = events[0].t + elapsed
    let txt = ''
    let color = getComputedStyle(document.documentElement).getPropertyValue('--text-default')?.trim() || '#E6E6E6'
    let size = 18
    for (const e of events as any[]) {
      if (e.t > tCut) break
      if ((e as any).kind === 'style') { color = (e as any).color || color; size = (e as any).size || size }
      else if ((e as any).kind === 'snap') { txt = (e as any).content }
      else if ((e as any).op === 'ins' && (e as any).ch) txt = txt.slice(0, (e as any).from) + (e as any).ch + txt.slice((e as any).to)
      else if ((e as any).op === 'del') txt = txt.slice(0, (e as any).from) + txt.slice((e as any).to)
    }
    textBuffer.current = txt
    // flatter, simpler background
    ctx.clearRect(0,0,c.width,c.height)
    ctx.fillStyle = 'rgba(255,255,255,0.03)'
    ctx.fillRect(0,0,c.width,c.height)
    // text
    ctx.fillStyle = color
    ctx.font = `${size}px Inter, system-ui`
    wrapText(ctx, txt, 28, 44, c.width - 56, 30)
  }

  // Animate while playing
  useEffect(() => {
    if (!open || events.length === 0) return
    const render = (time: number) => {
      if (!playing) return
      if (!startRef.current) startRef.current = time
      const total = events[events.length - 1].t - events[0].t
      const elapsed = Math.min(total, (time - startRef.current) * speed)
      const p = total === 0 ? 0 : elapsed / total
      setElapsedSec(Math.round(elapsed / 1000))
      setProgress(p)
      drawAt(p)
      if (elapsed >= total) { setPlaying(false); return }
      rafRef.current = requestAnimationFrame(render)
    }
    rafRef.current = requestAnimationFrame(render)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [open, events, playing, speed])

  const togglePlay = () => { setPlaying((p) => !p); startRef.current = 0 }

  // Export removed per simplified UI requirement

  // Auto-play when opened and data ready
  useEffect(() => { if (open && events.length > 0) { setPlaying(true); startRef.current = 0 } }, [open, events])

  // Space/any key to start
  useEffect(() => {
    if (!open) return
    const handler = () => { setPlaying(true); startRef.current = 0 }
    window.addEventListener('keydown', handler, { once: true })
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 'min(1000px, 94vw)', height: '74vh', background: 'var(--panel)', color: 'var(--ink)', padding: 16, borderRadius: 12, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Playback</strong>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="ghost" onClick={togglePlay}>{playing ? 'Pause' : 'Play'}</button>
            <button className="ghost" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <canvas ref={canvasRef} width={1000} height={520} style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))', borderRadius: 8 }} />
          <div style={{ position: 'absolute', bottom: 12, right: 12, fontSize: 12, color: 'var(--muted)', padding: '4px 8px', background: 'rgba(0,0,0,0.18)', borderRadius: 999 }}>{new Date(elapsedSec * 1000).toISOString().substring(14,19)}</div>
        </div>
        <div style={{ position: 'relative', width: '100%', height: 12, background: 'rgba(255,255,255,0.08)', borderRadius: 999 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${progress * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--brand), var(--accent))', transition: 'width 200ms cubic-bezier(.22,.61,.36,1)' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ')
  let line = ''
  for (const w of words) {
    const test = line + w + ' '
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y)
      line = w + ' '
      y += lineHeight
    } else {
      line = test
    }
  }
  ctx.fillText(line, x, y)
}


