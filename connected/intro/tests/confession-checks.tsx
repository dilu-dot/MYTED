import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import App from '../src/App'
import { CONFESSION } from '../src/lib/confession'
import { LETTER_REVEAL_PROGRESS } from '../src/lib/animation'
import { setMotionPreference } from '../src/lib/motion'
import '../src/index.css'

const button = document.querySelector<HTMLButtonElement>('#run-confession')!
const report = document.querySelector<HTMLElement>('#report')!
const root = createRoot(document.querySelector('#test-stage')!)
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
const assert = (test: unknown, message: string) => { if (!test) throw new Error(message) }
async function until(test: () => boolean, message: string, timeout = 10000) {
  const start = performance.now()
  while (!test()) { if (performance.now() - start > timeout) throw new Error(message); await wait(30) }
}
const scene = () => document.querySelector<HTMLElement>('.scene')!
const letter = () => document.querySelector<HTMLElement>('.confession-letter')!
const paragraphs = () => Array.from(document.querySelectorAll<HTMLElement>('.letter-body > p'))
const reveals = () => Array.from(document.querySelectorAll<HTMLElement>('.letter-body [data-reveal]'))
const readable = (paragraph: HTMLElement) => {
  const accessible = Array.from(paragraph.querySelectorAll('.sr-only'))
  return accessible.length ? accessible.map(el => el.textContent).join(' ') : paragraph.textContent
}
async function scrollToY(y: number) {
  window.scrollTo({ top: y, behavior: 'instant' })
  await frame(); await frame()
  await until(() => Math.abs(Number(scene().dataset.progress) - Number(scene().dataset.inputProgress)) < .00001, 'Playhead did not settle')
}
button.onclick = async () => {
  button.disabled = true
  const results: string[] = [], errors: string[] = []
  const previousMotion = localStorage.getItem('teddy-motion')
  const reduced = new URLSearchParams(location.search).has('static')
  const error = (event: ErrorEvent) => errors.push(event.message)
  window.addEventListener('error', error)
  const pass = (message: string) => { results.push('PASS ' + message); report.textContent = results.join('\n') }
  try {
    setMotionPreference(reduced ? 'reduced' : 'full')
    root.render(<StrictMode><App/></StrictMode>)
    await until(() => !document.querySelector('.loading') && !!letter(), 'Intro assets did not finish loading', 25000)
    await scrollToY(0)
    assert(ScrollTrigger.getAll().length === 1, 'Duplicate cinematic ScrollTrigger')
    assert(document.querySelector<HTMLElement>('.sequence')!.dataset.frame === '0', 'Original first frame missing')
    assert(letter().dataset.ready === 'false', 'Letter starts before the cinematic')
    if (!reduced) assert(reveals().every(el => el.dataset.reveal === 'waiting'), 'Text animated before white')
    pass('intro remains intact; one pin; confession waits below the cinematic')

    await scrollToY(innerHeight * 4.5 * .5)
    assert(document.querySelector<HTMLElement>('.sequence')!.dataset.frame === '102', 'Midpoint frame changed')
    await scrollToY(innerHeight * 4.5 * .94)
    assert(letter().dataset.ready === 'false', 'Letter appears before the opening finishes')
    const boundaryY = Math.ceil(innerHeight * 4.5 * LETTER_REVEAL_PROGRESS)
    await scrollToY(boundaryY)
    await until(() => letter().dataset.ready === 'true', 'Letter did not appear at the white handoff')
    assert(getComputedStyle(document.querySelector('.white-paper')!).opacity === '1', 'Boundary is not pure white')
    await until(() => !document.querySelector('[data-testid="splash-canvas"]'), 'Fluid leaks onto the letter')
    const greetingBounds = paragraphs()[0].getBoundingClientRect()
    assert(greetingBounds.top >= 0 && greetingBounds.bottom < innerHeight, 'Greeting needs extra blank-page scrolling')
    assert(Math.abs(scrollY - boundaryY) < 2, 'Handoff forces an automatic scroll')
    pass('greeting appears directly when the paper opens; no blank pages or automatic scroll')

    for (const element of reveals()) {
      const top = scrollY + element.getBoundingClientRect().top
      await scrollToY(Math.max(boundaryY, top - innerHeight * .3))
      if (!reduced && element === reveals()[0]) {
        await until(() => element.dataset.reveal === 'revealing', 'Greeting did not start animating')
        await wait(200)
        const characters = Array.from(element.querySelector('.inline-flex')!.querySelectorAll<HTMLElement>('[data-reveal-piece="letter"]'))
        assert(characters.length > 3, 'Greeting is not split into individual letters')
        const opacity = characters.map(char => Number(getComputedStyle(char).opacity))
        assert(opacity[0] > opacity[opacity.length - 1] + .1, 'Characters reveal together instead of letter by letter')
        assert(!element.querySelector('[data-reveal-piece="word"]'), 'Word animation remains in the confession')
        const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        for (const char of element.querySelectorAll('[data-reveal-piece="letter"]')) {
          assert(Array.from(graphemes.segment(char.textContent || '')).length === 1, 'An emoji was split apart')
          assert(char.textContent !== '\uFE0F', 'Emoji variation selector animated separately')
        }
        pass('letters reveal independently from left to right; emoji graphemes remain intact')
      }
      await until(() => element.dataset.reveal === (reduced ? 'static' : 'complete'), 'A word reveal did not finish', 7000)
      assert(getComputedStyle(element).visibility === 'visible', 'Paper covers confession')
      for (const word of element.querySelectorAll<HTMLElement>('[aria-hidden="true"]')) {
        const style = getComputedStyle(word)
        assert(Number(style.opacity) > .999 && (style.filter === 'blur(0px)' || style.filter === 'none'), 'Word remains faded or blurred')
      }
    }
    assert(paragraphs().length === 6, 'Paragraph breaks changed')
    paragraphs().forEach((paragraph, i) => assert(readable(paragraph) === CONFESSION[i], 'Exact confession text changed in paragraph ' + (i + 1)))
    assert(document.documentElement.scrollWidth <= innerWidth, 'Horizontal overflow')
    pass('all six exact paragraphs and emojis are readable, sharp and within the viewport')

    const count = reveals().length
    await scrollToY(innerHeight * 4.5 * .5)
    assert(document.querySelector<HTMLElement>('.sequence')!.dataset.frame === '102', 'Reverse cinematic frame changed')
    await scrollToY(0)
    assert(document.querySelector<HTMLElement>('.sequence')!.dataset.frame === '0', 'Reverse scroll does not restore the first frame')
    assert(letter().dataset.ready === 'false', 'Letter remains active above its boundary')
    const pausedCycles = reveals().map(el => el.dataset.revealCycle)
    await wait(700)
    assert(reveals().every((el, i) => el.dataset.revealCycle === pausedCycles[i]), 'Offscreen text keeps looping')
    pass('reverse scroll restores the intro and pauses offscreen text animation')
    const firstTop = scrollY + paragraphs()[0].getBoundingClientRect().top
    await scrollToY(Math.max(boundaryY, firstTop - innerHeight * .3))
    assert(reveals().length === count, 'Returning to the letter changes its text groups')
    if (!reduced) {
      const greeting = reveals()[0]
      await until(() => greeting.dataset.reveal === 'complete', 'Greeting did not settle after returning')
      const cycle = Number(greeting.dataset.revealCycle)
      await wait(1000)
      assert(greeting.dataset.reveal === 'complete', 'Text does not stay readable between loops')
      await until(() => greeting.dataset.reveal === 'blurring', 'Text did not repeat its blur', 7000)
      await wait(120)
      const changed = Array.from(greeting.querySelectorAll<HTMLElement>('[data-reveal-piece]')).some(el => Number(getComputedStyle(el).opacity) < .99)
      assert(changed, 'Repeat cycle changes state but produces no visible blur')
      await until(() => Number(greeting.dataset.revealCycle) > cycle && greeting.dataset.reveal === 'complete', 'Repeated reveal did not finish', 7000)
      pass('visible text holds sharp, blurs again, and completes another letter-by-letter reveal')
    }

    setMotionPreference('reduced')
    await until(() => reveals().every(el => el.dataset.reveal === 'static'), 'Reduced motion did not render static text')
    paragraphs().forEach((paragraph, i) => assert(readable(paragraph) === CONFESSION[i], 'Reduced-motion text changed'))
    assert(ScrollTrigger.getAll().length === 1, 'Motion change adds another pin')
    assert(errors.length === 0, errors.join('; '))
    pass('reduced motion is static and complete; no runtime errors')
  } catch (error) { results.push('FAIL ' + String(error)) }
  finally {
    flushSync(() => root.render(null))
    if (ScrollTrigger.getAll().length !== 0) results.push('FAIL pin was not cleaned up')
    setMotionPreference(previousMotion === 'full' || previousMotion === 'reduced' ? previousMotion : 'auto')
    window.removeEventListener('error', error)
    report.textContent = results.join('\n') + '\nDONE'
    button.disabled = false
  }
}
