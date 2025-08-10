export type Keystroke = { t: number; op: 'ins' | 'del'; ch?: string; from: number; to: number }

export type DocSettings = {
  font: 'sans' | 'serif' | 'mono' | 'rounded' | 'slab'
  size: number
  color: string
  theme: 'dark' | 'light'
  spell: boolean
  focus: boolean
  gradient?: string
}

export type DocAnalytics = {
  typos: number
  wpmBest: number
  secondsFocused: number
  charCount: number
  wordCount: number
}

export type Doc = {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  settings: DocSettings
  analytics: DocAnalytics
  keystrokes: Keystroke[]
  version: number
}

export type Theme = 'dark' | 'light'

