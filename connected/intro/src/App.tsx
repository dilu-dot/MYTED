import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import gsap from 'gsap'
import { SceneSplashCursor } from '@/components/ui/scene-splash-cursor'
import { ParticleTypography } from '@/components/ui/particle-typography'
import { InteractiveTeddy } from '@/components/ui/interactive-teddy'
import { CinematicAtmosphere } from '@/components/ui/cinematic-atmosphere'
import { sceneLayout,SOURCE_CONTENT_HEIGHT } from '@/lib/scene-layout'
import { FRAME_COUNT,LETTER_REVEAL_PROGRESS,clamp,greetingOpacity,paperOpacity,smoothstep } from '@/lib/animation'
import { motionReduced, subscribeMotion } from '@/lib/motion'
import { FrameSource } from '@/lib/frame-source'
const ConfessionLetter=lazy(()=>import('@/components/ui/confession-letter').then(module=>({default:module.ConfessionLetter})))

gsap.registerPlugin(ScrollTrigger)
const chapters=['A little secret','A letter, just for you','Some things are worth unfolding']

function App(){
  const sceneRef=useRef<HTMLElement>(null),experienceRef=useRef<HTMLElement>(null),canvasRef=useRef<HTMLCanvasElement>(null)
  const progressRef=useRef(0),inputRef=useRef(0),scrollingRef=useRef(false),typographyInteractionRef=useRef(false),handoffRef=useRef(false)
  const renderSequenceRef=useRef<()=>void>(()=>{}),triggerRef=useRef<ScrollTrigger|null>(null)
  const [loaded,setLoaded]=useState(0),[failed,setFailed]=useState(false),[chapter,setChapter]=useState(0)

  useEffect(()=>{
    const scene=sceneRef.current!,experience=experienceRef.current!,canvas=canvasRef.current!
    const ctx=canvas.getContext('2d',{alpha:false})!,reduced=matchMedia('(prefers-reduced-motion: reduce)')
    const chrome=experience.querySelectorAll<HTMLElement>('[data-chrome]')
    let disposed=false,raf=0,last=0,lastInput=-Infinity,idleTimer=0,width=innerWidth,height=innerHeight
    let lastPaint=-1,lastBlend=-1,lastCamera=-1,lastChapter=-1,chromeHidden=false,dirty=true
    const activity=()=>window.dispatchEvent(new Event('teddy:scroll-activity'))
    const wake=()=>{if(!disposed&&!document.hidden&&!raf)raf=requestAnimationFrame(tick)}
    renderSequenceRef.current=wake
    const source=new FrameSource(import.meta.env.BASE_URL,()=>{dirty=true;wake()},setLoaded,()=>{if(!disposed)setFailed(true)})
    scene.dataset.inputProgress='0'

    const applyProgress=(p:number)=>{
      progressRef.current=p
      experience.style.setProperty('--paper',String(paperOpacity(p)))
      experience.style.setProperty('--intro',String(greetingOpacity(p)))
      experience.style.setProperty('--chrome',String(1-smoothstep(.8,.93,p)))
      experience.style.setProperty('--progress',`${p*100}%`)
      scene.dataset.progress=p.toFixed(5)
      if(chromeHidden!==(p>=.93)){chromeHidden=p>=.93;chrome.forEach(el=>{el.inert=chromeHidden})}
      const next=p<.29?0:p<.7?1:2
      if(next!==lastChapter){lastChapter=next;setChapter(next)}
      window.dispatchEvent(new Event('teddy:progress'))
      window.dispatchEvent(new Event('teddy:scroll'))
    }
    const paint=(p:number)=>{
      const position=clamp(p/.94)*191
      source.request(position,scrollingRef.current)
      const lower=motionReduced(reduced.matches)?Math.round(position):Math.floor(position),upper=motionReduced(reduced.matches)?lower:Math.min(191,lower+1),a=source.get(lower,!scrollingRef.current),b=source.get(upper,!scrollingRef.current)
      if(!a&&!b)return
      const blend=motionReduced(reduced.matches)?0:position-lower
      const camera=motionReduced(reduced.matches)?1:1+.014*smoothstep(0,.75,p)*(1-smoothstep(.82,.95,p))
      if(!dirty&&Math.abs(lastPaint-position)<.0001&&lastBlend===blend&&lastCamera===camera)return
      const l=sceneLayout(width,height),w=1280*l.scale*camera,h=SOURCE_CONTENT_HEIGHT*l.scale*camera
      const x=(width-w)/2,y=l.offsetY-(h-SOURCE_CONTENT_HEIGHT*l.scale)*.5-(motionReduced(reduced.matches)?0:5*smoothstep(0,.75,p))
      ctx.globalAlpha=1
      if(width/height<.9){ctx.fillStyle='#230c13';ctx.fillRect(0,0,width,Math.max(0,y));ctx.fillRect(0,Math.max(0,y+h),width,height)}
      ctx.drawImage(a??b!,x,y,w,h)
      if(a&&b&&blend>0){ctx.globalAlpha=blend;ctx.drawImage(b,x,y,w,h);ctx.globalAlpha=1}
      canvas.dataset.frame=String(a&&b?Math.round(position):a?lower:upper)
      canvas.dataset.framePosition=String(a&&b?position:a?lower:upper)
      canvas.dataset.blend=String(a&&b?blend:0)
      canvas.dataset.cameraScale=String(camera)
      canvas.dataset.cacheBytes=String(source.decodedBytes)
      canvas.dataset.cacheCount=String(source.decodedCount)
      lastPaint=position;lastBlend=blend;lastCamera=camera;dirty=false
    }
    function tick(now:number){
      raf=0;if(disposed||document.hidden)return
      const dt=last?Math.min((now-last)/1000,.05):1/60;last=now
      const target=handoffRef.current?0:inputRef.current
      const previous=progressRef.current
      let p=motionReduced(reduced.matches)?target:previous+(target-previous)*(1-Math.exp(-dt/.11))
      if(Math.abs(target-p)<.0001)p=target
      const scrolling=now-lastInput<130||Math.abs(target-p)>.0001||handoffRef.current
      if(scrollingRef.current!==scrolling){scrollingRef.current=scrolling;scene.dataset.scrolling=String(scrolling);activity()}
      if(p!==previous||dirty)applyProgress(p)
      paint(p)
      if(Math.abs(target-p)>.0001)raf=requestAnimationFrame(tick)
      else last=0
    }
    const onInput=(p:number)=>{
      p=p<.00001?0:p>.99999?1:p
      if(inputRef.current===p)return
      inputRef.current=p;lastInput=performance.now();scene.dataset.inputProgress=p.toFixed(5)
      if(!scrollingRef.current){scrollingRef.current=true;scene.dataset.scrolling='true';activity()}
      window.dispatchEvent(new Event('teddy:scroll'))
      clearTimeout(idleTimer);idleTimer=window.setTimeout(wake,160)
      wake()
    }
    const positionLetter=(duration:number)=>experience.style.setProperty('--letter-overlap',`${scene.offsetHeight+duration*(1-LETTER_REVEAL_PROGRESS)}px`)
    const trigger=ScrollTrigger.create({trigger:scene,start:'top top',end:()=>`+=${innerHeight*4.5}`,pin:true,invalidateOnRefresh:true,onUpdate:self=>onInput(self.progress),onRefresh:self=>positionLetter(self.end-self.start)})
    triggerRef.current=trigger
    const resize=()=>{
      width=innerWidth;height=innerHeight
      positionLetter(trigger.end-trigger.start)
      // The source is 1280px wide; do not paint a giant 4K/retina backing buffer.
      const ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1_800_000/(width*height)))
      canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio))
      ctx.setTransform(ratio,0,0,ratio,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high'
      ctx.fillStyle='#230c13';ctx.fillRect(0,0,width,height)
      dirty=true;wake()
    }
    const visibility=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0}else wake()}
    resize();applyProgress(0);onInput(trigger.progress)
    window.addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',visibility);const unsubscribeMotion=subscribeMotion(()=>{dirty=true;wake()})
    return()=>{
      disposed=true;renderSequenceRef.current=()=>{};cancelAnimationFrame(raf);clearTimeout(idleTimer);source.dispose();trigger.kill();triggerRef.current=null
      window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);unsubscribeMotion()
    }
  },[])

  const skip=()=>{const trigger=triggerRef.current;if(trigger)window.scrollTo({top:Math.ceil(trigger.start+(trigger.end-trigger.start)*LETTER_REVEAL_PROGRESS),behavior:'instant'})}
  return <main ref={experienceRef} className="experience">
    <section ref={sceneRef} className="scene" aria-label="Teddy's letter: scroll to unfold the story">
      <canvas ref={canvasRef} className="sequence" role="img" aria-label="A little teddy discovers a sealed letter, opens it, and unfolds the paper toward you."/>
      <InteractiveTeddy progressRef={inputRef} playheadRef={progressRef} handoffRef={handoffRef} renderSequenceRef={renderSequenceRef}/>
      <div className="scene-shade" aria-hidden="true"/>
      <CinematicAtmosphere progressRef={progressRef} scrollingRef={scrollingRef}/>
      <div className="white-paper" aria-hidden="true"/>
    </section>
    <header className="masthead chrome" data-chrome>
      <a href="#" className="wordmark" aria-label="Teddy — return to beginning" onClick={e=>{e.preventDefault();window.scrollTo({top:0,behavior:'instant'})}}>teddy<span className="wordmark-dot">.</span></a>
      <span className="edition">A LITTLE LOVE STORY</span>
      <div className="masthead-actions"><button onClick={skip} className="skip">Skip intro <span aria-hidden="true">↗</span></button></div>
    </header>
    <div className="intro" data-chrome>
      <p className="eyebrow"><span/> SOME THINGS ARE MEANT FOR YOU</p>
      <ParticleTypography progressRef={progressRef} interactionRef={typographyInteractionRef}/>
      <p className="intro-note">He’s been keeping something for you.<br/>Take your time. Let it unfold.</p>
    </div>
    <footer className="scene-footer chrome" data-chrome>
      <div className="chapter"><span className="chapter-number">0{chapter+1}</span><span className="chapter-divider"/><span aria-live="polite">{chapters[chapter]}</span></div>
      <div className="scroll-cue"><span className="scroll-line"/> SCROLL TO UNFOLD <span aria-hidden="true">↓</span></div>
    </footer>
    <div className="timeline chrome" aria-hidden="true"><span/></div>
    {loaded<FRAME_COUNT&&<div className="loading chrome" role="status">{failed?'A frame could not load. Please refresh to try again.':`Preparing a little secret · ${Math.round(loaded/FRAME_COUNT*100)}%`}</div>}
    <SceneSplashCursor progressRef={progressRef} interactionRef={typographyInteractionRef} scrollingRef={scrollingRef}/>
    <Suspense fallback={<section className="confession-letter" data-ready="false" aria-hidden="true" style={{minHeight:'200svh'}}/>}>
      <ConfessionLetter progressRef={progressRef}/>
    </Suspense>
  </main>
}
export default App
