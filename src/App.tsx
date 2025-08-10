import './App.css'
import { TopBar } from './components/TopBar'
import { Editor } from './editor/Editor'
import { HUD } from './components/HUD'
import { useGlobalShortcuts } from './shortcuts'
import { applyTheme } from './theme'
import { useEffect } from 'react'
import { useAppStore } from './store'
import { Toast } from './components/Toast'
import { Playback } from './components/Playback'
import { Onboarding } from './components/Onboarding'

function App() {
  const { settings } = useAppStore()
  useEffect(() => { applyTheme(settings.theme) }, [])
  useGlobalShortcuts()
  function shouldRefocusEditor(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null
    if (!el) return true
    // Do not steal focus from inputs, textareas, title field, popups, or when already inside the editor
    if (el.closest('.inline-title, input, textarea, select, .topbar, .hud, .speed-pop, .font-pop, .color-pop')) return false
    if (el.closest('.editor-surface, .editor-input')) return true
    return true
  }

  function placeCaretAtEnd(root: HTMLElement) {
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    range.selectNodeContents(root)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  return (
    <div
      onMouseDown={(e) => {
        if (!shouldRefocusEditor(e.target)) return
        const ed = document.querySelector('.editor-input') as HTMLElement | null
        if (!ed) return
        const wasFocused = document.activeElement === ed
        ed.focus()
        if (!wasFocused) placeCaretAtEnd(ed)
      }}
      onKeyDownCapture={(e) => {
        const ed = document.querySelector('.editor-input') as HTMLElement | null
        if (!ed) return
        const inEditable = (e.target as HTMLElement | null)?.closest('.editor-input, .inline-title, input, textarea, select')
        if (inEditable) return
        const wasFocused = document.activeElement === ed
        ed.focus()
        if (!wasFocused) placeCaretAtEnd(ed)
      }}
    >
      <TopBar />
      <Editor />
      <HUD />
      <Toast />
      <Playback />
      <Onboarding />
    </div>
  )
}

export default App
