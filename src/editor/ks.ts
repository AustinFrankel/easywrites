// Singleton keystroke worker shared across app
export const ksWorker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })


