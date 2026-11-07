import { motionReduced, subscribeMotion } from '@/lib/motion'
import { useEffect,useRef,type RefObject } from 'react'
import { createTeddyRig,dampLook,lookAt,REST,type Look } from '@/lib/teddy-rig'
interface Props {progressRef:RefObject<number>;playheadRef?:RefObject<number>;handoffRef:RefObject<boolean>;renderSequenceRef:RefObject<()=>void>}
export function InteractiveTeddy({progressRef,playheadRef,handoffRef,renderSequenceRef}:Props){
 const canvasRef=useRef<HTMLCanvasElement>(null)
 useEffect(()=>{
  const canvas=canvasRef.current!
    const reduced=matchMedia('(prefers-reduced-motion: reduce)')
  const fine=matchMedia('(any-hover: hover) and (any-pointer: fine)')
  const current:Look={...REST}
  let target:Look={...REST},renderer:ReturnType<typeof createTeddyRig>=null,image:HTMLImageElement|null=null
  let ready=false,disposed=false,raf=0,last=0,tracking=false,returning=false
  const eligible=()=>fine.matches&&!motionReduced(reduced.matches)&&!document.hidden
  const release=()=>{if(handoffRef.current){handoffRef.current=false;renderSequenceRef.current()}}
  const publish=()=>{
   canvas.dataset.yaw=String(current.yaw);canvas.dataset.pitch=String(current.pitch)
   canvas.dataset.eyeX=String(current.eyeX);canvas.dataset.eyeY=String(current.eyeY)
  }
  const draw=(now:number)=>{
   raf=0;if(disposed||!renderer||!eligible())return
   const dt=last?Math.min((now-last)/1000,.05):1/60;last=now
   const moving=dampLook(current,target,dt,returning)
   const distance=Math.max(Math.abs(current.yaw),Math.abs(current.pitch),Math.abs(current.eyeX)*.015,Math.abs(current.eyeY)*.015)
   if(distance>0)renderer.render(current)
   publish()
   canvas.style.opacity=String(Math.min(1,distance/.008))
   if(moving)raf=requestAnimationFrame(draw)
   else{last=0;if(returning){returning=false;canvas.style.opacity='0';if(progressRef.current>0){renderer.dispose();renderer=null}release();canvas.dataset.state=progressRef.current>0?'cinematic':'interactive'}}
  }
  const wake=()=>{if(!raf&&renderer&&!disposed&&eligible())raf=requestAnimationFrame(draw)}
  const ensure=()=>{
   if(!renderer&&ready&&image&&eligible()&&progressRef.current===0){
    try{renderer=createTeddyRig(canvas,image)}catch(error){console.warn('Teddy rig unavailable',error)}
    canvas.dataset.rig=renderer?'curved-2.5d':'unavailable'
   }
  }
  const sync=()=>{
   tracking=eligible()&&progressRef.current===0&&(playheadRef?.current??0)===0
   if(!eligible()){
    cancelAnimationFrame(raf);raf=0;last=0;Object.assign(current,REST);target={...REST};returning=false
    renderer?.dispose();renderer=null;canvas.style.opacity='0';canvas.dataset.state='static';release();publish();return
   }
   if(tracking){ensure();canvas.dataset.state='interactive';release();publish();return}
   target={...REST}
   if(Object.values(current).some(n=>Math.abs(n)>.00001)&&progressRef.current<.95){
    handoffRef.current=true;returning=true;canvas.dataset.state='handoff';wake()
   }else{
    cancelAnimationFrame(raf);raf=0;last=0;Object.assign(current,REST);canvas.style.opacity='0';returning=false
    renderer?.dispose();renderer=null;canvas.dataset.state='cinematic';release();publish()
   }
  }
  const move=(event:PointerEvent)=>{
   if(event.pointerType==='touch'||!tracking||progressRef.current!==0)return
   ensure();if(!renderer)return
   returning=false;target=lookAt(event.clientX,event.clientY,canvas.getBoundingClientRect(),innerWidth,innerHeight)
   canvas.dataset.state='interactive';wake()
  }
  const leave=()=>{
   if(!renderer||!eligible())return
   target={...REST};returning=true;if(progressRef.current===0)canvas.dataset.state='returning';wake()
  }
  const resize=()=>{renderer?.resize();wake()}
  const lost=(event:Event)=>{event.preventDefault();cancelAnimationFrame(raf);raf=0;renderer?.dispose();renderer=null;canvas.style.opacity='0';release()}
  const restored=()=>{renderer=null;sync();wake()}
  image=new Image();image.src=`${import.meta.env.BASE_URL}frames/frame_000000.jpg`
  void image.decode().then(()=>{if(!disposed){ready=true;sync()}}).catch(()=>{if(!disposed){canvas.dataset.rig='unavailable';release()}})
  window.addEventListener('pointermove',move,{passive:true});window.addEventListener('blur',leave)
  document.documentElement.addEventListener('pointerleave',leave)
  window.addEventListener('resize',resize,{passive:true});window.addEventListener('teddy:scroll',sync)
  document.addEventListener('visibilitychange',sync);fine.addEventListener('change',sync);const unsubscribeMotion=subscribeMotion(sync)
  canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored)
  sync()
  return()=>{
   disposed=true;cancelAnimationFrame(raf);renderer?.dispose();release()
   window.removeEventListener('pointermove',move);window.removeEventListener('blur',leave)
   document.documentElement.removeEventListener('pointerleave',leave)
   window.removeEventListener('resize',resize);window.removeEventListener('teddy:scroll',sync)
   document.removeEventListener('visibilitychange',sync);fine.removeEventListener('change',sync);unsubscribeMotion()
   canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);image=null
  }
 },[progressRef,playheadRef,handoffRef,renderSequenceRef])
 return <canvas ref={canvasRef} data-testid="teddy-rig" aria-hidden="true" className="teddy-rig" />
}
