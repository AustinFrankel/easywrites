export function applyTheme(theme: 'dark' | 'light') {
  const root = document.documentElement
  if (theme === 'light') {
    root.style.setProperty('--bg', '#ffffff')
    root.style.setProperty('--panel', '#f6f7f9')
    root.style.setProperty('--ink', '#111827')
    root.style.setProperty('--muted', '#4b5563')
    // default text color for light mode
    root.style.setProperty('--text-default', '#111827')
  } else {
    root.style.setProperty('--bg', '#0B0F14')
    root.style.setProperty('--panel', '#111826')
    root.style.setProperty('--ink', '#E6E6E6')
    root.style.setProperty('--muted', '#9AA4B2')
    // default text color for dark mode
    root.style.setProperty('--text-default', '#E6E6E6')
  }
}

