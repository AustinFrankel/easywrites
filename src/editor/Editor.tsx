import { useEffect, useMemo, useRef, useState } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { $getRoot, type EditorState } from 'lexical'
import { useAppStore } from '../store'
import { db } from '../db'
import { ksWorker } from './ks'
import type { Doc } from '../types'

const Placeholder = () => <div className="editor-placeholder">Start typing…</div>

function countWords(text: string): number {
  const matches = text.trim().match(/\p{L}+(?:[\p{L}\p{Mn}\p{Pd}'’]+)?/gu)
  return matches ? matches.length : 0
}

// Rolling WPM over 10s
class RollingWPM {
  private samples: Array<{ t: number; chars: number }> = []
  private ema: number = 0
  private initialized = false
  addSample(chars: number) {
    const t = Date.now()
    const last = this.samples[this.samples.length - 1]
    if (last && last.chars === chars) {
      // ignore idle samples to avoid spurious 0 spikes
      return
    }
    this.samples.push({ t, chars })
    const cutoff = t - 10000
    this.samples = this.samples.filter(s => s.t >= cutoff)
    // update EMA from instant WPM when we have enough samples
    if (this.samples.length >= 2) {
      const first = this.samples[0]
      const last = this.samples[this.samples.length - 1]
      const deltaChars = Math.max(0, last.chars - first.chars)
      const deltaMinutes = Math.max(1e-3, (last.t - first.t) / 60000)
      const instant = (deltaChars / 5) / deltaMinutes
      const alpha = 0.2
      this.ema = this.initialized ? (alpha * instant + (1 - alpha) * this.ema) : instant
      this.initialized = true
    }
  }
  getWPM(): number {
    if (!this.initialized) return 0
    return Math.round(this.ema)
  }
}

export function Editor() {
  const { currentId, createDoc, saveDoc, settings } = useAppStore()
  const [doc, setDoc] = useState<Doc | null>(null)
  // keep for future pause detection; currently unused intentionally
  const [_lastInputAt, setLastInputAt] = useState<number>(0)
  const autosaveTimer = useRef<number | null>(null)
  const focusSeconds = useRef(0)
  const focusTick = useRef<number | null>(null)
  const workerRef = useRef<Worker | null>(ksWorker)
  const rolling = useRef(new RollingWPM())
  const prevSize = useRef<number | null>(null)

  useEffect(() => {
    ;(async () => {
      let id = currentId
      if (!id) id = await createDoc()
      const loaded = await db.docs.get(id!)
      if (loaded) {
        setDoc(loaded)
        window.dispatchEvent(new CustomEvent('easywrites:title', { detail: { id: loaded.id, title: loaded.title } }))
      }
    })()
  }, [currentId, createDoc])

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return
      if (focusTick.current != null) return
      focusTick.current = window.setInterval(() => {
        focusSeconds.current += 1
        dispatchMetrics()
      }, 1000)
    }
    const onBlur = () => {
      if (focusTick.current != null) {
        window.clearInterval(focusTick.current)
        focusTick.current = null
      }
    }
    const onVis = () => {
      if (document.visibilityState === 'visible' && document.hasFocus()) onFocus()
      else onBlur()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVis)
    onVis()
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVis)
      if (focusTick.current != null) window.clearInterval(focusTick.current)
    }
  }, [])

  const initialConfig = useMemo(
    () => ({
      namespace: 'easywrites',
      onError(error: Error) {
        console.error(error)
      },
      editable: true,
      theme: {
        paragraph: '',
      },
    }), []
  )

  function dispatchMetrics() {
    const text = doc?.content ?? ''
    const words = countWords(text)
    const chars = [...text].length
    rolling.current.addSample(chars)
    const wpm = chars === 0 ? 0 : rolling.current.getWPM()
    const event = new CustomEvent('easywrites:metrics', {
      detail: { wpm, words, chars, typos: 0, focusSeconds: focusSeconds.current },
    })
    window.dispatchEvent(event)
  }

  const onChange = (state: EditorState) => {
    const textContent = state.read(() => $getRoot().getTextContent())
    setLastInputAt(Date.now())
    if (!doc) return
    const next: Doc = { ...doc, content: textContent, updatedAt: Date.now() }
    setDoc(next)
    // debounce autosave every ~500ms
    if (autosaveTimer.current != null) window.clearTimeout(autosaveTimer.current)
    autosaveTimer.current = window.setTimeout(async () => {
      await saveDoc(next)
      dispatchMetrics()
    }, 500)
    // fire metrics immediately for snappy HUD and counter updates
    dispatchMetrics()
  }

  useEffect(() => {
    const onExport = () => {
      if (!doc) return
      const blob = new Blob([doc.content], { type: 'text/plain;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${doc.title || 'Untitled'}.txt`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)
    }
    window.addEventListener('easywrites:export', onExport)
    return () => window.removeEventListener('easywrites:export', onExport)
  }, [doc])

  useEffect(() => {
    // init worker
    // worker established in singleton
    const onKey = (e: KeyboardEvent) => {
      if (!doc || !workerRef.current) return
      const selection = (document.getSelection?.()?.anchorOffset ?? 0) as number
      const op: 'ins' | 'del' = e.key === 'Backspace' || e.key === 'Delete' ? 'del' : 'ins'
      const ch = op === 'ins' && e.key.length === 1 ? e.key : undefined
      const from = selection
      const to = selection
      workerRef.current.postMessage({ type: 'log', payload: { t: Date.now(), op, ch, from, to } })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doc])

  // Log style changes and content snapshots for playback fidelity
  useEffect(() => {
    if (!workerRef.current) return
    workerRef.current.postMessage({ type: 'style', payload: { t: Date.now(), kind: 'style', color: settings.color, size: settings.size, gradient: settings.gradient } })
  }, [settings.color, settings.size, settings.gradient])

  useEffect(() => {
    if (!workerRef.current || !doc) return
    const snap = () => workerRef.current!.postMessage({ type: 'snap', payload: { t: Date.now(), kind: 'snap', content: doc!.content } })
    const id = window.setInterval(snap, 1000)
    return () => window.clearInterval(id)
  }, [workerRef.current, doc])

  // Smoothly animate size changes so text grows/shrinks instead of shifting
  useEffect(() => {
    if (prevSize.current == null) { prevSize.current = settings.size; return }
    const surface = document.querySelector('.editor-surface') as HTMLElement | null
    if (!surface) return
    surface.animate([
      { transform: 'scale(0.98)' },
      { transform: 'scale(1.00)' }
    ], { duration: 150, easing: 'ease' })
    prevSize.current = settings.size
  }, [settings.size])

  // Keep metrics updating even when idle, prevents flashing to zero between keystrokes
  useEffect(() => {
    const id = window.setInterval(() => dispatchMetrics(), 300)
    return () => window.clearInterval(id)
  }, [doc])

  if (!doc) return null

  const fontFamily =
    settings.font === 'mono' ? 'var(--font-mono)'
    : settings.font === 'serif' ? 'var(--font-serif)'
    : settings.font === 'rounded' ? 'var(--font-rounded)'
    : settings.font === 'slab' ? 'var(--font-slab)'
    : 'var(--font-ui)'

  const textStyle: React.CSSProperties = settings.gradient === 'brand'
    ? { background: 'linear-gradient(90deg, var(--brand), var(--accent))', WebkitBackgroundClip: 'text', color: 'transparent' }
    : settings.gradient === 'sunset'
    ? { background: 'linear-gradient(90deg, #F59E0B, #F97066)', WebkitBackgroundClip: 'text', color: 'transparent' }
    : settings.gradient === 'sea'
    ? { background: 'linear-gradient(90deg, #6EE7F2, #22C55E)', WebkitBackgroundClip: 'text', color: 'transparent' }
    : { color: settings.color || 'var(--text-default)' }

  return (
    <div className="editor-container" data-focus={settings.focus ? '1' : '0'}>
      <div className="editor-surface" style={{ fontFamily, fontSize: settings.size }}>
        <div className="word-counter" aria-hidden>{countWords(doc.content)}</div>
        {/* floating toolbar removed to avoid interfering with top title interactions */}
        <LexicalComposer initialConfig={initialConfig}>
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="editor-input"
                aria-label="Editor"
                spellCheck={true}
                style={textStyle}
              />
            }
            placeholder={<Placeholder />}
            ErrorBoundary={({ children }) => <>{children}</>}
          />
          <HistoryPlugin />
          <OnChangePlugin onChange={onChange} />
          <AutoFocusPlugin />
        </LexicalComposer>
      </div>
    </div>
  )
}


