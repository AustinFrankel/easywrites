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
  return (
    <div
      onMouseDown={() => (document.querySelector('.editor-input') as HTMLElement | null)?.focus()}
      onKeyDownCapture={() => (document.querySelector('.editor-input') as HTMLElement | null)?.focus()}
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
