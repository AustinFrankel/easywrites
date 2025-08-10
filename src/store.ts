import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import { db } from './db'
import type { Doc, DocSettings } from './types'

type AppState = {
  currentId: string | null
  docsIndex: Array<{ id: string; title: string; updatedAt: number }>
  settings: DocSettings
  hudVisible: boolean
  createDoc: () => Promise<string>
  loadDoc: (id: string) => Promise<Doc | null>
  saveDoc: (doc: Doc) => Promise<void>
  updateTitle: (title: string) => Promise<void>
  setHudVisible: (v: boolean) => void
  setSettings: (p: Partial<DocSettings>) => void
}

const defaultSettings: DocSettings = {
  font: 'sans',
  size: 18,
  color: '#E6E6E6',
  theme: 'dark',
  spell: true,
  focus: false,
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentId: null,
      docsIndex: [],
      settings: defaultSettings,
      hudVisible: true,

      async createDoc() {
        const id = nanoid()
        const now = Date.now()
        const doc: Doc = {
          id,
          title: 'Untitled',
          content: '',
          createdAt: now,
          updatedAt: now,
          settings: { ...defaultSettings },
          analytics: { typos: 0, wpmBest: 0, secondsFocused: 0, charCount: 0, wordCount: 0 },
          keystrokes: [],
          version: 1,
        }
        await db.docs.put(doc)
        set((s) => ({ currentId: id, docsIndex: [{ id, title: doc.title, updatedAt: now }, ...s.docsIndex] }))
        return id
      },

      async loadDoc(id) {
        const doc = await db.docs.get(id)
        if (doc) set({ currentId: id })
        return doc ?? null
      },

      async saveDoc(doc) {
        doc.updatedAt = Date.now()
        await db.docs.put(doc)
        set((s) => ({
          docsIndex: [{ id: doc.id, title: doc.title, updatedAt: doc.updatedAt }, ...s.docsIndex.filter(d => d.id !== doc.id)],
        }))
      },

      async updateTitle(title) {
        const id = get().currentId
        if (!id) return
        const doc = await db.docs.get(id)
        if (!doc) return
        doc.title = title
        await get().saveDoc(doc)
        window.dispatchEvent(new CustomEvent('easywrites:title', { detail: { id, title } }))
      },

      setHudVisible(v) { set({ hudVisible: v }) },
      setSettings(p) {
        set((s) => ({ settings: { ...s.settings, ...p } }))
        // Notify listeners and return typing focus to the editor input
        try {
          window.dispatchEvent(new CustomEvent('easywrites:settings-changed'))
          // Restore focus on next tick so typing always goes to the editor
          window.setTimeout(() => {
            const el = document.querySelector('.editor-input') as HTMLElement | null
            el?.focus()
          }, 0)
        } catch {
          // no-op in non-DOM environments
        }
      },
    }),
    { name: 'easywrites-store' }
  )
)

