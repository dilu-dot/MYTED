export type MotionPreference = 'auto' | 'full' | 'reduced'
const KEY = 'teddy-motion'
const EVENT = 'teddy:motion-preference'
function readPreference(): MotionPreference {
  try {
    const value = localStorage.getItem(KEY)
    if (value === 'full' || value === 'reduced') return value
  } catch { /* Storage is optional in private browsing. */ }
  return 'auto'
}
let preference = readPreference()
export function motionReduced(systemReduced?: boolean) {
  return preference === 'reduced' || (preference === 'auto' && (systemReduced ?? matchMedia('(prefers-reduced-motion: reduce)').matches))
}
export function setMotionPreference(value: MotionPreference) {
  preference = value
  try { if (value === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, value) } catch { /* Use this session's choice. */ }
  window.dispatchEvent(new Event(EVENT))
}
export function subscribeMotion(listener: () => void) {
  const media = matchMedia('(prefers-reduced-motion: reduce)')
  const storage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) { preference = readPreference(); listener() }
  }
  media.addEventListener('change', listener)
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', storage)
  return () => {
    media.removeEventListener('change', listener)
    window.removeEventListener(EVENT, listener)
    window.removeEventListener('storage', storage)
  }
}
