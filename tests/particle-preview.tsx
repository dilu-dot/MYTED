import { setMotionPreference } from '../src/lib/motion'
import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import App from '../src/App'
import '../src/index.css'

// Explicit opt-in on a development-only route; never part of the production entry.
document.querySelector('#enable-motion')!.addEventListener('click', () => {
  setMotionPreference('full')
  createRoot(document.querySelector('#root')!).render(<StrictMode><App /></StrictMode>)
}, { once: true })
