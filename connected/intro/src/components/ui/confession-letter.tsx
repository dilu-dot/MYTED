import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import BlurText from '@/components/ui/blur-text'
import { motionReduced, subscribeMotion } from '@/lib/motion'

import { CONFESSION } from '@/lib/confession'
import { LETTER_REVEAL_PROGRESS } from '@/lib/animation'

const REVEAL = "I don't know how or when it happened, but somehow I started liking you."
const AFTER_REVEAL = CONFESSION[2].slice(REVEAL.length + 1)
const FROM = { filter: 'blur(8px)', opacity: 0, y: 14 }
const TO = [{ filter: 'blur(3px)', opacity: .55, y: 3 }, { filter: 'blur(0px)', opacity: 1, y: 0 }]

export function ConfessionLetter({ progressRef }: { progressRef: RefObject<number> }) {
  const sectionRef = useRef<HTMLElement>(null)
  const [ready, setReady] = useState(false)
  const reduced = useSyncExternalStore(subscribeMotion, motionReduced, () => true)
  useEffect(() => {
    const sync = () => setReady(progressRef.current >= LETTER_REVEAL_PROGRESS)
    sync()
    window.addEventListener('teddy:progress', sync)
    return () => window.removeEventListener('teddy:progress', sync)
  }, [progressRef])
  const shared = {
    active: ready, reducedMotion: reduced, effect: 'blur' as const, animateBy: 'letters' as const,
    direction: 'bottom' as const, staggerFrom: 'start' as const, blur: 8, distance: 14,
    stepDuration: .3, loop: true, loopDelay: 5, focusOnHover: false, threshold: .12, rootMargin: '0px 0px -8% 0px',
    // The explicit two-step curve avoids the upstream spring's overshoot in a quiet letter.
    animationFrom: FROM, animationTo: TO
  }
  return <section ref={sectionRef} className="confession-letter" aria-label="A personal letter" data-testid="confession-letter" data-ready={ready}>
    <div className="letter-sheet">
      <div className="letter-stationery" aria-hidden="true"><span/><i>t</i><span/></div>
      <svg className="letter-flourish letter-flourish-top" viewBox="0 0 110 110" fill="none" aria-hidden="true"><path d="M8 102V8h94M18 72V18h54M18 48C18 28 28 18 48 18M8 60C36 60 60 36 60 8M30 30c20 0 26 11 18 18-7 8-18 2-18-18Z"/></svg>
      <svg className="letter-flourish letter-flourish-bottom" viewBox="0 0 110 110" fill="none" aria-hidden="true"><path d="M8 102V8h94M18 72V18h54M18 48C18 28 28 18 48 18M8 60C36 60 60 36 60 8M30 30c20 0 26 11 18 18-7 8-18 2-18-18Z"/></svg>
    <article className="letter-body" aria-label="Teddy's confession" aria-hidden={!ready} inert={!ready}>
      <BlurText {...shared} text={CONFESSION[0]} className="letter-greeting" delay={60}/>
      <BlurText {...shared} text={CONFESSION[1]} className="letter-preface" delay={26}/>
      <p className="letter-paragraph letter-confession" data-testid="confession-paragraph">
        <BlurText {...shared} as="span" text={REVEAL} className="letter-emphasis" delay={30} stepDuration={.4}/>{' '}
        <BlurText {...shared} as="span" text={AFTER_REVEAL} className="letter-following" delay={16} startDelay={3}/>
      </p>
      {CONFESSION.slice(3).map((text, index) => <BlurText {...shared} key={text} text={text} delay={index === 2 ? 14 : 18} className={`letter-paragraph${index === 2 ? ' letter-closing' : ''}`}/>)}
      <div className="letter-continuation"><p>The words were only the beginning.</p><a href="/story/">There’s something more <span aria-hidden="true">↗</span></a><small>A little world, just for you.</small></div>
    </article>
      <div className="letter-endmark" aria-hidden="true"><span/><svg viewBox="0 0 24 24" fill="none"><path d="M12 3c0 5-4 9-9 9 5 0 9 4 9 9 0-5 4-9 9-9-5 0-9-4-9-9Z"/></svg><span/></div>
    </div>
  </section>
}
