import { setMotionPreference } from '../src/lib/motion'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { StrictMode } from 'react'
import App from '../src/App'
import SplashCursor from '../src/components/ui/splash-cursor'
import { InteractiveTeddy } from '../src/components/ui/interactive-teddy'
import { SceneSplashCursor } from '../src/components/ui/scene-splash-cursor'
import '../src/index.css'

const stage = document.querySelector('#test-stage')!
const report = document.querySelector('#report')!
const button = document.querySelector<HTMLButtonElement>('#run-checks')!
let root = createRoot(stage)
const results: string[] = []
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const tick = () => new Promise<number>(resolve => requestAnimationFrame(resolve))
const assert = (value: boolean, text: string) => { if (!value) throw new Error(text) }
async function until(fn: () => boolean, text: string) {
  const start = performance.now()
  while (!fn()) { if (performance.now() - start > 15000) throw new Error(text); await wait(30) }
}
const mount = (element: React.ReactNode) => {
  flushSync(() => root.unmount()); root = createRoot(stage)
  flushSync(() => root.render(<StrictMode>{element}</StrictMode>))
}
const pointer = (x: number, y = innerHeight * .7) => window.dispatchEvent(new PointerEvent('pointermove', {clientX:x,clientY:y,pointerType:'mouse',pointerId:1}))
const canvas = () => document.querySelector<HTMLCanvasElement>('[data-testid="splash-canvas"]')
const overlay = () => document.querySelector<HTMLElement>('[data-testid="fluid-overlay"]')!
async function scroll(p: number,settle=true) {
  window.scrollTo(0, innerHeight * 4.5 * p)
  await until(() => Math.abs(Number(document.querySelector<HTMLElement>('.scene')?.dataset.inputProgress)-p)<.002,'Raw scroll input incorrect')
  await tick();await tick()
  if(settle){
    await until(()=>document.querySelector<HTMLElement>('.scene')!.dataset.progress===document.querySelector<HTMLElement>('.scene')!.dataset.inputProgress,'Eased playhead did not settle')
    await until(()=>document.querySelector<HTMLElement>('[data-testid="teddy-rig"]')?.dataset.state!=='handoff','Handoff did not settle')
    await tick();await tick()
  }
}
async function check(name: string, run: () => Promise<void>) {
  if(new URLSearchParams(location.search).get('only')==='motion'&&!name.startsWith('eased subframes'))return
  try { await run(); results.push(`PASS ${name}`) }
  catch (error) { results.push(`FAIL ${name}: ${error instanceof Error ? error.message : error}`) }
  report.textContent = results.join('\n')
}
button.onclick = async () => {
  button.disabled = true; button.parentElement!.style.pointerEvents = 'none'; results.length = 0
  const errors: string[] = []
  const error = (event: ErrorEvent) => errors.push(event.message)
  window.addEventListener('error',error)
  const previousMotion = localStorage.getItem('teddy-motion')
  setMotionPreference('auto')
  const nativeMatch = window.matchMedia.bind(window)
  const media = (fine: boolean, reduced: boolean) => {
    document.documentElement.dataset.qaMotion = String(fine && !reduced)
    window.matchMedia = query => {
      const result = nativeMatch(query)
      if (query.includes('any-hover')) Object.defineProperty(result,'matches',{value:fine})
      if (query.includes('prefers-reduced-motion')) Object.defineProperty(result,'matches',{value:reduced})
      return result
    }
  }
  const native: Record<string, Function> = {}
  const created: Record<string,number> = {}, deleted: Record<string,number> = {}
  const proto = WebGL2RenderingContext.prototype as unknown as Record<string, Function>
  let draws = 0, rigDraws = 0, requested = false, sample: Uint8Array | undefined
  for (const type of ['Texture','Framebuffer','Program','Shader','Buffer','VertexArray']) {
    for (const verb of ['create','delete']) {
      const key = verb + type
      native[key] = proto[key]
      proto[key] = function(this: WebGL2RenderingContext, ...args: unknown[]) {
        const result = native[key].apply(this,args)
        const counts = verb === 'create' ? created : deleted
        counts[type] = (counts[type] || 0) + 1
        return result
      }
    }
  }
  native.drawArrays = proto.drawArrays
  proto.drawArrays = function(this: WebGL2RenderingContext, ...args: unknown[]) {
    const result = native.drawArrays.apply(this,args); draws++
    if ((this.canvas as HTMLCanvasElement).dataset.testid === 'teddy-rig') rigDraws++
    if (requested && (this.canvas as HTMLCanvasElement).dataset.testid === 'splash-canvas' && this.getParameter(this.FRAMEBUFFER_BINDING) === null) {
      sample = new Uint8Array(this.drawingBufferWidth*this.drawingBufferHeight*4)
      this.readPixels(0,0,this.drawingBufferWidth,this.drawingBufferHeight,this.RGBA,this.UNSIGNED_BYTE,sample)
      requested = false
    }
    return result
  }
  const capture = async () => {
    sample = undefined; requested = true
    pointer(innerWidth*.45); await tick(); pointer(innerWidth*.48)
    await until(() => !!sample,`No WebGL frame captured: ${canvas()?.dataset.status}; scrolling=${document.querySelector<HTMLElement>('.scene')?.dataset.scrolling}`)
    return sample!
  }
  try {
    media(true,false); mount(<App />)
    await until(()=>!document.querySelector('.loading'),'Frames did not finish loading')
    await check('official WebGL engine initializes; old spotlight is absent',async()=>{
      await until(()=>!!canvas() && ['running','idle','ready'].includes(canvas()!.dataset.status || ''),'WebGL unavailable or initialization failed')
      assert(!document.querySelector('[data-testid="spotlight"]'),'Old spotlight still mounted')
      assert(['high','medium'].includes(document.querySelector('[data-testid="splash-cursor"]')!.getAttribute('data-quality')!),'Invalid initial quality')
      await until(()=>!document.querySelector('.loading'),'Frames did not load')
      results.push(`WEBGL initial quality: ${document.querySelector('[data-testid="splash-cursor"]')!.getAttribute('data-quality')}`)
    })
    await check('background animates before scrolling while Teddy stays still',async()=>{
      const bg=document.querySelector<HTMLCanvasElement>('[data-testid="cinematic-atmosphere"]')!
      assert(bg.dataset.status==='running','Background is not running')
      const ctx=bg.getContext('2d')!,before=ctx.getImageData(0,0,bg.width,bg.height).data
      const first=Number(bg.dataset.frames),held=rigDraws
      await wait(220)
      const after=ctx.getImageData(0,0,bg.width,bg.height).data
      assert(Number(bg.dataset.frames)>first,'Background is not advancing')
      assert(before.some((v,i)=>v!==after[i]),'Background pixels are static')
      assert(rigDraws===held,'Background caused an idle Teddy animation')
    })
    await check('head and eyes follow independently at top; no autonomous idle loop',async()=>{
      const rig=document.querySelector<HTMLCanvasElement>('[data-testid="teddy-rig"]')!
      await until(()=>rig.dataset.rig==='curved-2.5d','Curved rig did not initialize')
      const idle=rigDraws;await wait(200);assert(rigDraws===idle,'Rig animates before mouse input')
      pointer(innerWidth*.96,innerHeight*.25)
      await until(()=>Number(rig.dataset.yaw)>.01,'Head did not turn right')
      assert(Number(rig.dataset.eyeX)>0,'Eyes did not follow right')
      pointer(innerWidth*.03,innerHeight*.15)
      await until(()=>Number(rig.dataset.yaw)<-.03,'Head did not turn left')
      assert(Number(rig.dataset.eyeX)<0,'Eyes did not follow left')
      await wait(850);const held=rigDraws,yaw=rig.dataset.yaw
      await wait(180);assert(rigDraws===held&&rig.dataset.yaw===yaw,'Last look does not hold still')
      assert(Math.abs(Number(rig.dataset.yaw))<=6.5*Math.PI/180+.0001,'Yaw exceeds limit')
      assert(Math.abs(Number(rig.dataset.pitch))<=4.5*Math.PI/180+.0001,'Pitch exceeds limit')
      assert(document.querySelector<HTMLElement>('.sequence')!.dataset.frame==='0','Cinematic moves during interaction')
      document.documentElement.dispatchEvent(new PointerEvent('pointerleave'))
      await until(()=>Number(rig.dataset.yaw)===0&&Number(rig.dataset.eyeX)===0,'Pointer exit did not restore rest')
      assert(getComputedStyle(rig).opacity==='0','Rest does not show exact original frame')
    })
    await check('scroll disables tracking, neutralizes head, then releases cinematic; top reverses',async()=>{
      const rig=document.querySelector<HTMLCanvasElement>('[data-testid="teddy-rig"]')!
      pointer(innerWidth*.03,innerHeight*.2);await until(()=>Number(rig.dataset.yaw)<-.03,'No look before handoff')
      await scroll(.03,false)
      if(rig.dataset.state==='handoff')assert(document.querySelector<HTMLElement>('.sequence')!.dataset.frame==='0','Cinematic advances during rig handoff')
      await until(()=>rig.dataset.state==='cinematic','Head handoff did not finish')
      await until(()=>document.querySelector<HTMLElement>('.sequence')!.dataset.frame==='6','Cinematic did not advance after handoff')
      pointer(innerWidth*.98,innerHeight*.2);await wait(120)
      assert(Number(rig.dataset.yaw)===0&&Number(rig.dataset.eyeX)===0,'Mouse still tracks during cinematic')
      await scroll(0);await until(()=>rig.dataset.rig==='curved-2.5d','Rig did not return at top')
      pointer(innerWidth*.96,innerHeight*.25);await until(()=>Number(rig.dataset.yaw)>.01,'Top did not re-enable tracking')
      document.documentElement.dispatchEvent(new PointerEvent('pointerleave'))
      await until(()=>Number(rig.dataset.yaw)===0,'Top did not return to rest')
    })
    await check('mouse movement renders real palette-colored fluid; clicks splash',async()=>{
      for(let i=0;i<18;i++){pointer(innerWidth*(.25+i*.02));await tick()}
      let pixels = await capture(); let visible=0, invalid=0
      for(let i=0;i<pixels.length;i+=4) if(pixels[i+3]>5){visible++;if(pixels[i]+2<Math.max(pixels[i+1],pixels[i+2]))invalid++}
      assert(visible>100,'Fluid not visible')
      assert(invalid===0,'Unexpected colors outside rose/ivory palette')
      window.dispatchEvent(new PointerEvent('pointerdown',{clientX:innerWidth*.5,clientY:innerHeight*.7,pointerType:'mouse'}))
      pixels = await capture()
      assert(pixels.some((value,index)=>index%4===3&&value>5),'Click splash did not render')
      results.push(`FLUID ${visible} visible pixels; no rainbow colors`)
    })
    await check('192-frame sequence scrubs and reverses with fluid active',async()=>{
      await scroll(.5);await until(()=>document.querySelector<HTMLElement>('.sequence')!.dataset.frame==='102','Wrong midpoint frame')
      await scroll(.2);await until(()=>document.querySelector<HTMLElement>('.sequence')!.dataset.frame==='41','Reverse frame incorrect')
    })
    await check('eased subframes, bounded decoded memory, and fluid suspension improve scrolling',async()=>{
      await scroll(.15)
      const positions:number[]=[],steps:number[]=[],budgets:string[]=[]
      window.scrollTo(0,innerHeight*4.5*.65)
      for(let i=0;i<24;i++){
        await tick()
        const scene=document.querySelector<HTMLElement>('.scene')!,sequence=document.querySelector<HTMLCanvasElement>('.sequence')!
        steps.push(Number(scene.dataset.progress));positions.push(Number(sequence.dataset.framePosition))
        budgets.push(canvas()?.dataset.status||'')
      }
      assert(steps.some(p=>p>.1501&&p<.649),'Playhead jumps directly to wheel target')
      assert(steps.every((p,i)=>i===0||p>=steps[i-1]),'Forward motion is not monotonic')
      results.push(`SUBFRAMES ${positions.map(p=>p.toFixed(2)).join(', ')} / progress ${steps.map(p=>p.toFixed(3)).join(', ')}`)
      assert(new Set(positions.map(p=>p.toFixed(3))).size>12,'Frame sequence stalls during easing')
      assert(positions.some(p=>Math.abs(p-Math.round(p))>.03),'Adjacent-frame blending is absent')
      assert(budgets.includes('paused'),'Fluid keeps competing during active scroll')
      const sequence=document.querySelector<HTMLCanvasElement>('.sequence')!
      assert(Number(sequence.dataset.cacheBytes)<=128*1024*1024,'Decoded frame memory exceeds budget')
      assert(Number(sequence.dataset.cacheCount)<=200,'Too many decoded frames retained')
      results.push(`MOTION ${new Set(positions.map(p=>p.toFixed(3))).size}/24 distinct subframes; cache ${(Number(sequence.dataset.cacheBytes)/1024/1024).toFixed(1)} MiB / ${sequence.dataset.cacheCount} frames`)
      await scroll(.65)
      assert(canvas()?.dataset.status!=='paused','Fluid did not resume after scroll settled')
      await scroll(.2)
    })
    await check('blank white ending removes the heart and stops every intro GPU effect',async()=>{
      await scroll(.8);assert(getComputedStyle(overlay()).opacity==='1','Early fade')
      await scroll(.875);assert(Math.abs(Number(getComputedStyle(overlay()).opacity)-.5)<.01,'Incorrect midpoint fade')
      await scroll(1);await until(()=>!canvas(),'Fluid remains mounted on white')
      assert(getComputedStyle(overlay()).opacity==='0','Fluid remains visible on white')
      assert(getComputedStyle(document.querySelector('.white-paper')!).opacity==='1','White page not opaque')
      assert(!document.querySelector('[data-testid="pulse-mark"]'),'Removed heart still exists')
      const bg=document.querySelector<HTMLCanvasElement>('[data-testid="cinematic-atmosphere"]')!
      assert(bg.dataset.status==='paused','Background runs on white')
      assert(bg.getContext('2d')!.getImageData(0,0,bg.width,bg.height).data.every(v=>v===0),'Background leaks onto white')
      const stopped=draws;await wait(120);assert(draws===stopped,'GPU draws continue on white')
      for(const type of Object.keys(created))assert(created[type]===deleted[type],`Leaked ${type} on white`)
      await scroll(.4);await until(()=>!!canvas(),'Reverse did not restart fluid')
      assert(document.querySelector<HTMLElement>('[data-testid="cinematic-atmosphere"]')!.dataset.status==='running','Background did not resume')
    })
    await check('controls remain clickable; greeting vortex restores all dots',async()=>{
      await scroll(0)
      const skip=document.querySelector<HTMLButtonElement>('.skip')!, box=skip.getBoundingClientRect()
      assert(skip.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)),'Skip control covered')
      assert(getComputedStyle(overlay()).pointerEvents==='none','Fluid intercepts clicks')
      const particles=document.querySelector<HTMLCanvasElement>('.particle-canvas')!
      const ctx=particles.getContext('2d')!, snap=()=>ctx.getImageData(0,0,particles.width,particles.height).data
      document.documentElement.dispatchEvent(new PointerEvent('pointerleave'))
      await until(()=>particles.dataset.motionState==='rest','Greeting not at rest')
      snap();snap();window.dispatchEvent(new Event('resize'));await tick();await tick()
      const before=snap(), count=particles.dataset.particleCount, rect=particles.getBoundingClientRect()
      pointer(rect.left+rect.width*.5,rect.top+rect.height*.3);await wait(400)
      assert(particles.dataset.motionState==='vortex','Particle vortex not active')
      assert(overlay().style.maskImage.includes('radial-gradient'),'Greeting not protected from fluid')
      document.documentElement.dispatchEvent(new PointerEvent('pointerleave'))
      await until(()=>particles.dataset.motionState==='rest','Greeting did not restore')
      const after=snap();let ink=0,diff=0
      for(let i=3;i<before.length;i+=4){ink+=before[i];diff+=Math.abs(before[i]-after[i])}
      assert(diff/ink<.01 && count===particles.dataset.particleCount,'Original dots not restored')
      results.push(`RESTORATION ${(diff/ink*100).toFixed(4)}% mask difference; ${count} dots`)
      skip.click();await until(()=>!canvas(),'Skip did not reach white')
    })
    await check('resize/DPR and idle loop work; adaptive quality stays valid',async()=>{
      await scroll(.4);await until(()=>!!canvas(),'No canvas')
      window.dispatchEvent(new Event('resize'));await tick();await tick()
      assert(canvas()!.width===Math.floor(canvas()!.clientWidth*Math.min(devicePixelRatio,2)),'Incorrect DPR width')
      pointer(innerWidth*.4);await tick();pointer(innerWidth*.41)
      await until(()=>canvas()!.dataset.status==='idle','Fluid did not stop while idle')
      const count=draws;await wait(100);assert(draws===count,'Idle simulation keeps drawing')
      results.push(`QUALITY current: ${document.querySelector('[data-testid="splash-cursor"]')!.getAttribute('data-quality')}`)
    })
    await check('scroll and active fluid frame timing remain responsive',async()=>{
      const measure=async(active:boolean)=>{
        media(true,!active);mount(<App />)
        await until(()=>!document.querySelector('.loading'),'Timing frames did not load')
        if(active)await until(()=>!!canvas(),'Timing WebGL did not initialize')
        const times:number[]=[]
        for(let i=0;i<110;i++){
          times.push(await tick());window.scrollTo(0,innerHeight*4.5*(.1+i/185))
          if(active)pointer(innerWidth*(.25+i/250))
        }
        const intervals=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b)
        return {median:intervals[Math.floor(intervals.length*.5)],p95:intervals[Math.floor(intervals.length*.95)]}
      }
      const baseline=await measure(false),active=await measure(true)
      results.push(`TIMING baseline ${JSON.stringify(baseline)}; fluid ${JSON.stringify(active)} ms`)
      results.push(`ADAPTIVE selected ${document.querySelector('[data-testid="splash-cursor"]')?.getAttribute('data-quality')}`)
      assert(active.p95<Math.max(55,baseline.p95*2),'Fluid frame time exceeds target')
    })
    await check('touch-only and reduced-motion modes allocate no WebGL',async()=>{
      const progress={current:0}, blocked={current:false},handoff={current:false},render={current:()=>{}}
      media(false,false);mount(<><SceneSplashCursor progressRef={progress} interactionRef={blocked}/><InteractiveTeddy progressRef={progress} handoffRef={handoff} renderSequenceRef={render}/></>);await wait(100)
      assert(!canvas(),'Touch-only device allocates WebGL')
      media(true,true);mount(<><SceneSplashCursor progressRef={progress} interactionRef={blocked}/><InteractiveTeddy progressRef={progress} handoffRef={handoff} renderSequenceRef={render}/></>);await wait(100)
      assert(!canvas(),'Reduced motion allocates WebGL')
    })
    await check('main-site motion switch enables the real particles and persists the choice',async()=>{
      media(true,true);setMotionPreference('auto');mount(<App />)
      await until(()=>!document.querySelector('.loading'),'Motion switch frames did not load')
      const particles=document.querySelector<HTMLCanvasElement>('.particle-canvas')!
      assert(getComputedStyle(particles).display!=='none','Reduced motion hides the dotted typography')
      assert(particles.dataset.motion==='static','Reduced motion is not static by default')
      assert(Number(particles.dataset.particleCount)>500,'Static dotted words missing')
      const button=document.querySelector<HTMLButtonElement>('.motion-toggle')!
      assert(button.textContent?.includes('Enable motion'),'No production motion opt-in')
      button.click()
      await until(()=>!!canvas()&&particles.dataset.motion==='full','Motion opt-in did not enable real effects')
      assert(localStorage.getItem('teddy-motion')==='full','Explicit motion choice not saved')
      const rect=particles.getBoundingClientRect()
      pointer(rect.left+rect.width*.5,rect.top+rect.height*.3)
      await until(()=>particles.dataset.motionState==='vortex','Production toggle did not enable particle vortex')
      button.click()
      await until(()=>!canvas()&&particles.dataset.motion==='static','Reduce motion did not stop effects')
      assert(particles.dataset.motionState==='rest','Disabled particles did not restore')
      setMotionPreference('auto')
    })
    await check('all GPU resources and listeners clean up through StrictMode',async()=>{
      media(true,false);mount(<SplashCursor intro={false} adaptive />);await wait(150);mount(null)
      const stopped=draws;pointer(300);await wait(100);assert(draws===stopped,'Drawing after unmount')
      for(const type of Object.keys(created)) assert(created[type]===deleted[type],`Leaked ${type}: ${created[type]} / ${deleted[type]}`)
      assert(errors.length===0,errors.join('; '))
      results.push(`RESOURCES created/deleted ${JSON.stringify(created)} / ${JSON.stringify(deleted)}`)
    })
  } catch(err){results.push(`FAIL runner: ${err}`)}
  finally{
    mount(null);window.matchMedia=nativeMatch;delete document.documentElement.dataset.qaMotion
    setMotionPreference(previousMotion==='full'||previousMotion==='reduced'?previousMotion:'auto')
    for(const key of Object.keys(native)) proto[key]=native[key]
    window.removeEventListener('error',error)
    report.textContent=results.join('\n')+'\nDONE';button.disabled=false;button.parentElement!.style.pointerEvents='auto'
  }
}
