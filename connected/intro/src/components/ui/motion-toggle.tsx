import { useSyncExternalStore } from 'react'
import { motionReduced, setMotionPreference, subscribeMotion } from '@/lib/motion'

export function MotionToggle() {
  const reduced = useSyncExternalStore(subscribeMotion, motionReduced, () => true)
  return <button className="motion-toggle" aria-pressed={!reduced}
    title={reduced ? 'Enable the particle vortex, flowing cursor and Teddy interaction' : 'Show the still version'}
    onClick={() => setMotionPreference(reduced ? 'full' : 'reduced')}>
    <span aria-hidden="true">{reduced ? '✦' : 'Ⅱ'}</span> {reduced ? 'Enable motion' : 'Reduce motion'}
  </button>
}
