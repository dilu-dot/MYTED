import { motionReduced, subscribeMotion } from '@/lib/motion'
import { useEffect,useRef,useState,type RefObject } from 'react'
import { createPortal } from 'react-dom'
import SplashCursor from '@/components/ui/splash-cursor'
import { greetingOpacity,cursorOpacity } from '@/lib/animation'
import { sourceToScene } from '@/lib/scene-layout'
const COLORS=['#E9AFC8','#FFF4EF','#BC7895']
interface Props {progressRef:RefObject<number>;interactionRef:RefObject<boolean>;scrollingRef?:RefObject<boolean>}
export function SceneSplashCursor({progressRef,interactionRef,scrollingRef}:Props){
  const overlayRef=useRef<HTMLDivElement>(null),firstMount=useRef(true)
  const [active,setActive]=useState(false),[intro,setIntro]=useState(true),[quality,setQuality]=useState<'high'|'medium'>('high')
  useEffect(()=>{
    const fine=matchMedia('(any-hover: hover) and (any-pointer: fine)')
    const reduced=matchMedia('(prefers-reduced-motion: reduce)')
    const memory=(navigator as Navigator&{deviceMemory?:number}).deviceMemory??8
    setQuality((navigator.hardwareConcurrency||8)<=4||memory<=4?'medium':'high')
    let greeting:DOMRect|undefined,rect:DOMRect|undefined,lastMask=-1
    const sync=()=>{
      const overlay=overlayRef.current,gate=cursorOpacity(progressRef.current)
      const enabled=fine.matches&&!motionReduced(reduced.matches)&&!document.hidden&&gate>0
      if(overlay){
        overlay.style.opacity=String(gate);overlay.dataset.active=String(enabled)
        const amount=Math.round(greetingOpacity(progressRef.current)*32)/32
        if(amount!==lastMask&&rect){
          lastMask=amount;const masks:string[]=[]
          if(greeting&&amount>0)masks.push(`radial-gradient(ellipse ${greeting.width*.65}px ${greeting.height}px at ${greeting.left+greeting.width/2}px ${greeting.top+greeting.height/2}px, rgba(0,0,0,${1-amount}) 0%, rgba(0,0,0,${1-amount*.8}) 55%, black 100%)`)
          const doll=sourceToScene(790,350,innerWidth,innerHeight),sx=rect.width/innerWidth,sy=rect.height/innerHeight
          masks.push(`radial-gradient(ellipse ${230*doll.scale*sx}px ${290*doll.scale*sy}px at ${doll.x*sx}px ${doll.y*sy}px, rgba(0,0,0,.10) 0%, rgba(0,0,0,.35) 65%, black 100%)`)
          overlay.style.maskImage=masks.join(',');overlay.style.maskComposite='intersect'
        }
      }
      if(enabled&&firstMount.current)firstMount.current=false
      else if(!enabled&&!firstMount.current)setIntro(false)
      setActive(enabled)
    }
    const measure=()=>{
      greeting=document.querySelector('.particle-greeting')?.getBoundingClientRect();rect=overlayRef.current?.getBoundingClientRect();lastMask=-1;sync()
    }
    measure()
    window.addEventListener('teddy:progress',sync);window.addEventListener('resize',measure,{passive:true})
    document.addEventListener('visibilitychange',sync);fine.addEventListener('change',sync);const unsubscribeMotion=subscribeMotion(sync)
    return()=>{window.removeEventListener('teddy:progress',sync);window.removeEventListener('resize',measure);document.removeEventListener('visibilitychange',sync);fine.removeEventListener('change',sync);unsubscribeMotion()}
  },[progressRef])
  return createPortal(<div ref={overlayRef} className="pointer-events-none fixed inset-0 z-20" data-testid="fluid-overlay" aria-hidden="true">
    {active&&<SplashCursor colors={COLORS} rainbow={false} size={2.05} force={1} swirl={3.5} trail={1.05} clickSplash colorSpeed={1} intensity={.75} momentum={1} shading={.65} glow={.1} quality={quality} intro={intro} contained={false} zIndex={0} adaptive blockedRef={interactionRef} pausedRef={scrollingRef}/>}
  </div>,document.body)
}
