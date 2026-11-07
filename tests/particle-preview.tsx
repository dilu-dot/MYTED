import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import App from '../src/App'
import '../src/index.css'

// Explicit opt-in on a development-only route; never part of the production entry.
document.querySelector('#enable-motion')!.addEventListener('click', () => {
  const nativeMatch = window.matchMedia.bind(window)
  window.matchMedia = query => {
    const result = nativeMatch(query)
    if (query.includes('prefers-reduced-motion')) Object.defineProperty(result, 'matches', { value: false })
    if (query.includes('any-hover')) Object.defineProperty(result, 'matches', { value: true })
    return result
  }
  document.documentElement.classList.add('motion-review')
  createRoot(document.querySelector('#root')!).render(<StrictMode><App /></StrictMode>)
}, { once: true })
