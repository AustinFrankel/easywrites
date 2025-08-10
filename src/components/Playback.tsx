import { useEffect, useRef, useState } from 'react'
import { ksWorker } from '../editor/ks'

type ExportFormat = 'mp4' | 'mov' | 'gif'

type KS = { t: number; op: 'ins'|'del'; ch?: string; from: number; to: number }

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function Playback() {
  const [open, setOpen] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [events, setEvents] = useState<KS[]>([])
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [progress, setProgress] = useState(0)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  useEffect(() => {
    const onKey = () => { setSpeedMenuOpen(false); setExportMenuOpen(false) }
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
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'dump') setEvents(e.data.payload as any) }
    ;(ksWorker as any).onmessage = onMsg
    ksWorker.postMessage({ type: 'dump' })
    return () => { (ksWorker as any).onmessage = null }
  }, [open])

  // Helper: draw frame for a given progress [0..1]
  const drawAt = (p: number) => {
    if (!open || events.length === 0) return
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    const total = Math.max(1, events[events.length - 1].t - events[0].t)
    const elapsed = Math.max(0, Math.min(total, total * p))
    const tCut = events[0].t + elapsed
    let txt = ''
    let color = getComputedStyle(document.documentElement).getPropertyValue('--text-default')?.trim() || '#E6E6E6'
    let size = 18
    for (const e of events as any[]) {
      if (e.t > tCut) break
      if (e.kind === 'style') { color = e.color || color; size = e.size || size }
      else if (e.kind === 'snap') { txt = e.content }
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
      const total = Math.max(1, events[events.length - 1].t - events[0].t)
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

  // If speed changes during playback, continue smoothly from current progress
  useEffect(() => {
    if (!playing) return
    startRef.current = 0
  }, [speed])

  async function exportVideo(format: ExportFormat) {
    const canvas = canvasRef.current!
    const stream = (canvas as any).captureStream ? (canvas as any).captureStream(30) : null
    if (!stream) return
    // Record WebM first
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' })
    const chunks: BlobPart[] = []
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
    recorder.onstop = async () => {
      const webmBlob = new Blob(chunks, { type: 'video/webm' })
      if (format === 'gif') {
        await transcodeWithFFmpeg(webmBlob, 'gif')
        return
      }
      if (format === 'mp4') {
        await transcodeWithFFmpeg(webmBlob, 'mp4')
        return
      }
      if (format === 'mov') {
        await transcodeWithFFmpeg(webmBlob, 'mov')
        return
      }
    }
    recorder.start()
    setPlaying(true)
    const total = events[events.length - 1]?.t - events[0]?.t || 3000
    setTimeout(() => { recorder.stop(); setPlaying(false) }, total / speed + 500)
  }

  async function transcodeWithFFmpeg(webmBlob: Blob, outExt: 'mp4' | 'mov' | 'gif') {
    window.dispatchEvent(new CustomEvent('easywrites:toast', { detail: { message: 'Preparing export…' } }))
    const mod: any = await import('@ffmpeg/ffmpeg')
    const ffmpeg = mod.createFFmpeg({ log: false })
    if (!ffmpeg.isLoaded()) await ffmpeg.load()
    const inputName = 'input.webm'
    const outputName = `output.${outExt}`
    ffmpeg.FS('writeFile', inputName, new Uint8Array(await webmBlob.arrayBuffer()))
    if (outExt === 'gif') {
      await ffmpeg.run('-i', inputName, '-vf', 'fps=12,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse', outputName)
    } else if (outExt === 'mp4') {
      await ffmpeg.run('-i', inputName, '-movflags', 'faststart', '-pix_fmt', 'yuv420p', '-vcodec', 'libx264', outputName)
    } else {
      await ffmpeg.run('-i', inputName, '-vcodec', 'libx264', '-pix_fmt', 'yuv420p', '-f', 'mov', outputName)
    }
    const data = ffmpeg.FS('readFile', outputName)
    const blob = new Blob([data.buffer], { type: outExt === 'gif' ? 'image/gif' : outExt === 'mp4' ? 'video/mp4' : 'video/quicktime' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `playback.${outExt}`
    a.click()
    URL.revokeObjectURL(a.href)
    window.dispatchEvent(new CustomEvent('easywrites:toast', { detail: { message: `Saved ${outExt.toUpperCase()}` } }))
  }

  // Do not auto-play; start only when user presses Play or types a key
  useEffect(() => { if (!open) { setPlaying(false); setProgress(0); startRef.current = 0 } }, [open])

  // Space/any key to start
  useEffect(() => {
    if (!open) return
    const handler = () => { setPlaying(true); startRef.current = 0 }
    window.addEventListener('keydown', handler, { once: true })
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Keep progress continuous across speed changes
  useEffect(() => {
    if (!playing || events.length === 0) return
    const total = Math.max(1, events[events.length - 1].t - events[0].t)
    const elapsed = progress * total
    // anchor the new startRef such that elapsed = (now - startRef) * speed
    const now = performance.now()
    startRef.current = now - (elapsed / speed)
  }, [speed])

  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 'min(1000px, 94vw)', height: '74vh', background: 'var(--panel)', color: 'var(--ink)', padding: 16, borderRadius: 12, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Playback</strong>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
            <button className="ghost" onClick={togglePlay}>{playing ? 'Pause' : 'Play'}</button>
            <span className={`speed-pop ${speedMenuOpen ? 'open' : ''}`}>
              <button className="ghost" onClick={() => setSpeedMenuOpen(v => !v)}>{speed}x</button>
              <div style={{ position: 'absolute', top: 30, right: 0, background: 'color-mix(in oklab, var(--panel) 92%, transparent)', borderRadius: 10, padding: 6, boxShadow: '0 10px 24px rgba(0,0,0,0.35)', display: speedMenuOpen ? 'flex' : 'none', gap: 4 }}>
                {[1, 1.25, 1.5, 2, 3].map((s) => (
                  <button key={s} className="ghost" onClick={() => { setSpeed(s); setSpeedMenuOpen(false) }}>{s}x</button>
                ))}
              </div>
            </span>
            <span style={{ position: 'relative' }}>
              <button className="ghost" onClick={() => setExportMenuOpen(v => !v)}>Export</button>
              <div style={{ position: 'absolute', top: 30, right: 0, background: 'color-mix(in oklab, var(--panel) 92%, transparent)', borderRadius: 10, padding: 6, boxShadow: '0 10px 24px rgba(0,0,0,0.35)', display: exportMenuOpen ? 'flex' : 'none', gap: 6 }}>
                <button className="ghost" onClick={() => exportVideo('mp4')}>MP4</button>
                <button className="ghost" onClick={() => exportVideo('mov')}>MOV</button>
                <button className="ghost" onClick={() => exportVideo('gif')}>GIF</button>
              </div>
            </span>
            <button className="ghost" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <canvas ref={canvasRef} width={1000} height={520} style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))', borderRadius: 8 }} />
          <div style={{ position: 'absolute', bottom: 12, right: 12, fontSize: 12, color: 'var(--muted)', padding: '4px 8px', background: 'rgba(0,0,0,0.18)', borderRadius: 999 }}>{formatElapsed(elapsedSec)}</div>
        </div>
        <div
          style={{ position: 'relative', width: '100%', height: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 999, cursor: 'pointer' }}
          onMouseDown={(e) => {
            setIsScrubbing(true)
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
            const p = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
            setProgress(p)
            drawAt(p)
          }}
          onMouseMove={(e) => {
            if (!isScrubbing) return
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
            const p = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
            setProgress(p)
            drawAt(p)
          }}
          onMouseUp={() => { setIsScrubbing(false); if (playing) { startRef.current = 0 } else { drawAt(progress) } }}
          onMouseLeave={() => setIsScrubbing(false)}
        >
          <div style={{ position: 'absolute', inset: 0, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${progress * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--brand), var(--accent))', transition: isScrubbing ? 'none' : 'width 200ms cubic-bezier(.22,.61,.36,1)' }} />
          </div>
          <div style={{ position: 'absolute', top: '50%', left: `${progress * 100}%`, transform: 'translate(-50%, -50%)', width: 16, height: 16, borderRadius: '50%', background: 'var(--ink)', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', transition: isScrubbing ? 'none' : 'left 160ms cubic-bezier(.22,.61,.36,1)' }} />
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


