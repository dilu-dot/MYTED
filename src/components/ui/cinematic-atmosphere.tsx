import { motionReduced, subscribeMotion } from '@/lib/motion'
import { useEffect,useRef,type RefObject } from 'react'
import { smoothstep } from '@/lib/animation'
import { sourceToScene } from '@/lib/scene-layout'

/** Time-driven scene atmosphere; does not animate the character or its pose. */
export function CinematicAtmosphere({progressRef,scrollingRef}:{progressRef:RefObject<number>;scrollingRef?:RefObject<boolean>}){
  const ref=useRef<HTMLCanvasElement>(null)
  useEffect(()=>{
    const canvas=ref.current!
    const reduced=matchMedia('(prefers-reduced-motion: reduce)'),ctx=canvas.getContext('2d')!
    let disposed=false,raf=0,last=0,phase=0,width=innerWidth,height=innerHeight,frames=0
    const opacity=()=>1-smoothstep(.78,.95,progressRef.current)
    const paint=()=>{
      ctx.clearRect(0,0,width,height)
      const scroll=progressRef.current,portrait=width/height<.9
      ctx.globalCompositeOperation='source-over'
      // Four flowing satin-light ribbons, drawn as curves rather than full-screen blur.
      for(let i=0;i<(portrait?3:5);i++){
        const y=height*(.12+i*.19)+Math.sin(phase*.24+i*1.7)*height*.045-scroll*height*.08
        const wave=Math.sin(phase*.31+i)*height*.11
        const x=Math.sin(phase*.17+i)*width*.08
        const gradient=ctx.createLinearGradient(0,y,width,y+height*.2)
        gradient.addColorStop(0,'rgba(233,175,200,0)');gradient.addColorStop(.25,'rgba(233,175,200,.16)')
        gradient.addColorStop(.6,'rgba(255,232,219,.11)');gradient.addColorStop(1,'rgba(188,120,149,0)')
        const path=()=>{
          ctx.beginPath();ctx.moveTo(-width*.2+x,y+height*.19)
          ctx.bezierCurveTo(width*.18,y-height*.18+wave,width*.55,y+height*.25-wave,width*1.2+x,y-height*.14)
        }
        ctx.strokeStyle=gradient;ctx.lineCap='round';ctx.lineWidth=portrait?12:22;path();ctx.stroke()
        ctx.globalAlpha=.65;ctx.lineWidth=1;path();ctx.stroke();ctx.globalAlpha=1
      }
      // Slow, sparse points of warm light in the velvet, never a cursor trail.
      for(let i=0;i<(portrait?16:28);i++){
        const seed=(Math.sin(i*127.1+3)*43758.5453)%1
        const x=((i*.61803398875+1+Math.sin(phase*.1+i)*.025)%1)*width
        const y=((i*.381966+2-phase*.009*(.5+Math.abs(seed))-scroll*.06)%1+1)%1*height
        const a=.08+.16*(.5+.5*Math.sin(phase*.65+i*2.8))
        ctx.fillStyle=`rgba(255,231,219,${a})`;ctx.beginPath();ctx.arc(x,y,.65+Math.abs(seed)*1.1,0,Math.PI*2);ctx.fill()
      }
      // Remove the atmosphere over the doll so its source texture and lighting stay intact.
      const doll=sourceToScene(790,350,width,height)
      ctx.save();ctx.globalCompositeOperation='destination-out';ctx.translate(doll.x,doll.y);ctx.scale(275*doll.scale,315*doll.scale)
      const mask=ctx.createRadialGradient(0,0,0,0,0,1)
      mask.addColorStop(0,'rgba(0,0,0,1)');mask.addColorStop(.72,'rgba(0,0,0,1)');mask.addColorStop(1,'rgba(0,0,0,0)')
      ctx.fillStyle=mask;ctx.fillRect(-1,-1,2,2);ctx.restore();ctx.globalCompositeOperation='source-over'
      canvas.dataset.frames=String(++frames)
    }
    const frame=(now:number)=>{
      raf=0;if(disposed||document.hidden||motionReduced(reduced.matches)||opacity()<=0)return
      raf=requestAnimationFrame(frame)
      if(last&&now-last<1000/(scrollingRef?.current?24:30)-.5)return
      if(last)phase+=Math.min((now-last)/1000,.1)
      last=now;paint()
    }
    const sync=()=>{
      canvas.style.opacity=String(opacity())
      if(opacity()<=0||document.hidden){cancelAnimationFrame(raf);raf=0;last=0;ctx.clearRect(0,0,width,height);canvas.dataset.status='paused';return}
      if(motionReduced(reduced.matches)){cancelAnimationFrame(raf);raf=0;last=0;phase=0;paint();canvas.dataset.status='static';return}
      canvas.dataset.status='running';if(!raf)raf=requestAnimationFrame(frame)
    }
    const resize=()=>{
      width=innerWidth;height=innerHeight
      const dpr=Math.min(devicePixelRatio||1,1,Math.sqrt(800_000/(width*height)));canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)
      paint();sync()
    }
    resize()
    window.addEventListener('resize',resize,{passive:true});window.addEventListener('teddy:progress',sync)
    document.addEventListener('visibilitychange',sync);const unsubscribeMotion=subscribeMotion(sync)
    return()=>{disposed=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);window.removeEventListener('teddy:progress',sync);document.removeEventListener('visibilitychange',sync);unsubscribeMotion();ctx.clearRect(0,0,width,height)}
  },[progressRef,scrollingRef])
  return <canvas ref={ref} className="cinematic-atmosphere" data-testid="cinematic-atmosphere" aria-hidden="true"/>
}
