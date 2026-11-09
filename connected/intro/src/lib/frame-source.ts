import { FRAME_COUNT,clamp } from '@/lib/animation'
interface Entry {image:ImageBitmap;bytes:number;used:number}
/** Every lightweight playback frame is ready before the loader finishes.
 * Full-detail frames are decoded only when scrolling rests, in a small LRU. */
export class FrameSource {
  private blobs:(Blob|undefined)[]=Array(FRAME_COUNT)
  private base=new Map<number,Entry>()
  private detail=new Map<number,Entry>()
  private pending=new Set<number>()
  private failed=new Set<number>()
  private abort=new AbortController()
  private disposed=false
  private next=0
  private loaded=0
  private detailJobs=0
  private clock=0
  private position=0
  private playing=false
  private bytes=0
  private decodeWidth:number
  readonly budget=128*1024*1024
  private root:string
  private onReady:()=>void
  private onProgress:(count:number)=>void
  private onError:()=>void
  constructor(root:string,onReady:()=>void,onProgress:(count:number)=>void,onError:()=>void){
    this.root=root;this.onReady=onReady;this.onProgress=onProgress;this.onError=onError
    this.decodeWidth=Math.min(1280,Math.max(768,Math.ceil(innerWidth/256)*256))
    for(let i=0;i<4;i++)void this.load()
  }
  private async load(){
    while(!this.disposed&&this.next<FRAME_COUNT){
      const index=this.next++
      try{
        const response=await fetch(`${this.root}frames/frame_${String(index).padStart(6,'0')}.jpg`,{signal:this.abort.signal,cache:'force-cache'})
        if(!response.ok)throw new Error(`Frame ${index}: ${response.status}`)
        const blob=await response.blob()
        if(this.disposed)return
        this.blobs[index]=blob
        const width=index===0?1280:512,height=Math.round(width*636/1280)
        const image=await createImageBitmap(blob,0,42,1280,636,{resizeWidth:width,resizeHeight:height,resizeQuality:'low'})
        if(this.disposed){image.close();return}
        const bytes=image.width*image.height*4
        this.base.set(index,{image,bytes,used:++this.clock});this.bytes+=bytes;this.loaded++
        if(this.loaded%8===0||this.loaded===FRAME_COUNT)this.onProgress(this.loaded)
        if(index===Math.floor(this.position)||index===Math.ceil(this.position))this.onReady()
        if(this.loaded===FRAME_COUNT)this.pumpDetail()
      }catch{if(!this.disposed)this.onError()}
    }
  }
  request(position:number,playing=false){this.position=clamp(position,0,FRAME_COUNT-1);this.playing=playing;this.pumpDetail()}
  get(index:number,preferDetail=true){
    const entry=preferDetail?this.detail.get(index)??this.base.get(index):this.base.get(index)
    if(entry)entry.used=++this.clock
    return entry?.image
  }
  get decodedBytes(){return this.bytes}
  get decodedCount(){return this.base.size+this.detail.size}
  private pumpDetail(){
    if(this.disposed||this.playing||this.loaded<FRAME_COUNT||this.detailJobs)return
    const candidates=[Math.floor(this.position),Math.ceil(this.position)]
    const index=candidates.find(i=>i>0&&!this.detail.has(i)&&!this.pending.has(i)&&!this.failed.has(i))
    if(index===undefined)return
    this.detailJobs++;this.pending.add(index)
    const width=this.decodeWidth,height=Math.round(width*636/1280)
    void createImageBitmap(this.blobs[index]!,0,42,1280,636,{resizeWidth:width,resizeHeight:height,resizeQuality:'high'}).then(image=>{
      if(this.disposed||Math.abs(index-this.position)>3){image.close();return}
      const bytes=image.width*image.height*4
      this.detail.set(index,{image,bytes,used:++this.clock});this.bytes+=bytes;this.evict()
      if(index===Math.floor(this.position)||index===Math.ceil(this.position))this.onReady()
    }).catch(()=>{this.failed.add(index)}).finally(()=>{this.detailJobs--;this.pending.delete(index);this.pumpDetail()})
  }
  private evict(){
    const protectedFrames=new Set([Math.floor(this.position),Math.ceil(this.position)])
    while(this.bytes>this.budget||this.detail.size>8){
      let oldest=-1,used=Infinity
      for(const [index,entry] of this.detail)if(!protectedFrames.has(index)&&entry.used<used){oldest=index;used=entry.used}
      if(oldest<0)return
      const entry=this.detail.get(oldest)!;entry.image.close();this.bytes-=entry.bytes;this.detail.delete(oldest)
    }
  }
  dispose(){
    this.disposed=true;this.abort.abort()
    for(const entry of [...this.base.values(),...this.detail.values()])entry.image.close()
    this.base.clear();this.detail.clear();this.blobs.length=0;this.bytes=0
  }
}
