// Minimal keystroke worker scaffold
// Logs events in a ring buffer (size limit)

export type Keystroke = { t: number; op: 'ins' | 'del'; ch?: string; from: number; to: number }
type StyleEvent = { t: number; kind: 'style'; color?: string; size?: number; gradient?: string }
type SnapEvent = { t: number; kind: 'snap'; content: string }

const MAX_EVENTS = 50000
let buffer: Array<Keystroke | StyleEvent | SnapEvent> = []

self.onmessage = (e: MessageEvent<{ type: string; payload?: any }>) => {
  const { type, payload } = e.data || {}
  if (type === 'log') {
    buffer.push(payload as Keystroke)
    if (buffer.length > MAX_EVENTS) buffer = buffer.slice(buffer.length - MAX_EVENTS)
  } else if (type === 'style' || type === 'snap') {
    buffer.push(payload)
    if (buffer.length > MAX_EVENTS) buffer = buffer.slice(buffer.length - MAX_EVENTS)
  } else if (type === 'dump') {
    ;(self as unknown as Worker).postMessage({ type: 'dump', payload: buffer })
  } else if (type === 'clear') {
    buffer = []
  }
}


