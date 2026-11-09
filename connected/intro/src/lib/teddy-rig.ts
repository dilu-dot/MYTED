import { clamp } from '@/lib/animation'
import { sceneLayout } from '@/lib/scene-layout'
export interface Look {yaw:number;pitch:number;eyeX:number;eyeY:number}
export const REST:Look={yaw:0,pitch:0,eyeX:0,eyeY:0}
export const MAX_YAW=6.5*Math.PI/180, MAX_PITCH=4.5*Math.PI/180
export function dampLook(current:Look,target:Look,dt:number,returning:boolean){
  let moving=false
  for(const key of ['yaw','pitch','eyeX','eyeY'] as const){
    const rate=returning?38:key.startsWith('eye')?17:10
    current[key]+=(target[key]-current[key])*(1-Math.exp(-rate*dt))
    if(Math.abs(target[key]-current[key])<(key.startsWith('eye')?.008:.00008))current[key]=target[key]
    else moving=true
  }
  return moving
}
export function lookAt(clientX:number,clientY:number,bounds:DOMRect,width:number,height:number):Look{
  const l=sceneLayout(width,height)
  const sx=((clientX-bounds.left)*width/bounds.width-l.offsetX)/l.scale
  const sy=((clientY-bounds.top)*height/bounds.height-l.offsetY)/l.scale+42
  const x=clamp((sx-790)/440,-1,1),y=clamp((sy-265)/330,-1,1)
  return {yaw:x*MAX_YAW,pitch:-y*MAX_PITCH,eyeX:x*2.8,eyeY:y*2}
}
// Original-image silhouette: both hood ears, hood, and complete plush face.
const HEAD='M650 265 C636 230 639 169 666 125 C657 112 660 95 675 88 C693 79 713 88 724 102 C759 90 823 87 866 101 C876 81 895 76 913 82 C935 84 947 104 933 123 C960 158 970 211 961 260 C954 305 936 339 913 358 C881 375 831 379 791 377 C748 376 711 364 683 343 C663 323 655 294 650 265 Z'
const EYES=[{x:732,y:260,rx:17,ry:18},{x:835,y:258,rx:18,ry:18}]
const VERTEX=`#version 300 es
precision highp float;precision highp int;
in vec3 position;in vec2 uv;out vec2 vUv;
uniform vec2 viewport;uniform vec3 sceneTransform;uniform vec2 angles;uniform vec2 eyes;uniform int mode;
void main(){
 vUv=uv;vec2 p=position.xy;if(mode==1||mode==2)p+=eyes;
 if(mode!=3){
  float camera=850.;vec3 w=vec3((p-vec2(790.,370.))*(camera-position.z)/camera,position.z);
  float cy=cos(angles.x),sy=sin(angles.x),cp=cos(angles.y),sp=sin(angles.y);
  w=vec3(w.x*cy+w.z*sy,w.y,-w.x*sy+w.z*cy);
  w=vec3(w.x,w.y*cp-w.z*sp,w.y*sp+w.z*cp);
  float r=angles.x*.16,cr=cos(r),sr=sin(r);w.xy=vec2(w.x*cr-w.y*sr,w.x*sr+w.y*cr);
  p=vec2(790.,370.)+w.xy*camera/(camera-w.z);
 }
 vec2 screen=sceneTransform.yz+(p-vec2(0.,42.))*sceneTransform.x;
 gl_Position=vec4(screen.x/viewport.x*2.-1.,1.-screen.y/viewport.y*2.,0.,1.);
}`
const FRAGMENT=`#version 300 es
precision highp float;precision highp int;
in vec2 vUv;out vec4 outColor;
uniform sampler2D original;uniform sampler2D mask;uniform sampler2D plate;uniform int mode;
void main(){
 vec2 p=vUv*vec2(1280.,720.);vec4 c=texture(original,vUv);float a=texture(mask,vUv).a;
 if(mode==3)c=texture(plate,vUv);
 if(mode==0){
  float l=1.-smoothstep(.64,1.,length((p-vec2(732.,260.))/vec2(18.,19.)));
  float r=1.-smoothstep(.64,1.,length((p-vec2(835.,258.))/vec2(19.,19.)));
  c=mix(c,texture(original,vUv+vec2(34./1280.,0.)),l);
  c=mix(c,texture(original,vUv-vec2(34./1280.,0.)),r);
 }
 if(mode==1||mode==2){
  vec2 center=mode==1?vec2(732.,260.):vec2(835.,258.);
  vec2 size=mode==1?vec2(17.,18.):vec2(18.,18.);
  a=1.-smoothstep(.72,1.,length((p-center)/size));
 }
 if(a<.002)discard;outColor=vec4(c.rgb*a,a);
}`
function depth(x:number,y:number){
  return Math.sqrt(Math.max(0,1-((x-795)/173)**2-((y-229)/170)**2))*54+Math.exp(-(((x-790)/110)**2+((y-280)/95)**2))*19
}
function geometry(x:number,y:number,width:number,height:number,cols:number,rows:number){
 const data:number[]=[]
 const v=(px:number,py:number)=>data.push(px,py,depth(px,py),px/1280,py/720)
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
  const x0=x+width*col/cols,x1=x+width*(col+1)/cols,y0=y+height*row/rows,y1=y+height*(row+1)/rows
  v(x0,y0);v(x1,y0);v(x0,y1);v(x0,y1);v(x1,y0);v(x1,y1)
 }
 return new Float32Array(data)
}
/** Curved source-textured head + independent eye layers over a fixed source body. */
export function createTeddyRig(canvas:HTMLCanvasElement,image:HTMLImageElement){
 const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:true,depth:false,stencil:false})
 if(!gl)return null
 const shaders:WebGLShader[]=[]
 const shader=(type:number,source:string)=>{
  const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);shaders.push(s)
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Rig shader failed')
  return s
 }
 const program=gl.createProgram()!
 try{
  gl.attachShader(program,shader(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program)
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Rig link failed')
 }catch(error){shaders.forEach(s=>gl.deleteShader(s));gl.deleteProgram(program);throw error}
 shaders.forEach(s=>gl.deleteShader(s))
 const mask=document.createElement('canvas');mask.width=1280;mask.height=720
 const maskCtx=mask.getContext('2d',{willReadFrequently:true})!
 maskCtx.fillStyle='white';maskCtx.filter='blur(0.65px)';maskCtx.fill(new Path2D(HEAD));maskCtx.filter='none'
 const alpha=maskCtx.getImageData(0,0,1280,720).data
 const plate=document.createElement('canvas');plate.width=1280;plate.height=720
 const plateCtx=plate.getContext('2d',{willReadFrequently:true})!;plateCtx.drawImage(image,0,0)
 const plateImage=plateCtx.getImageData(0,0,1280,720),data=plateImage.data
 // Fill only behind the hidden head using adjacent original cloth. Visible doll
 // textures remain source pixels; only narrow newly exposed edge strips are seen.
 for(let y=72;y<384;y++){
  let left=1280,right=0
  for(let x=630;x<980;x++)if(alpha[(y*1280+x)*4+3]>8){left=Math.min(left,x);right=Math.max(right,x)}
  if(left>=right)continue
  const l=(y*1280+left-6)*4,r=(y*1280+right+6)*4
  const a=[data[l],data[l+1],data[l+2]],b=[data[r],data[r+1],data[r+2]]
  for(let x=left;x<=right;x++){const t=(x-left)/(right-left),i=(y*1280+x)*4;for(let c=0;c<3;c++)data[i+c]=a[c]+(b[c]-a[c])*t}
 }
 plateCtx.putImageData(plateImage,0,0)
 const textures:WebGLTexture[]=[]
 for(const source of [image,mask,plate]){
  const t=gl.createTexture()!;textures.push(t);gl.bindTexture(gl.TEXTURE_2D,t)
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source)
 }
 const meshes=[geometry(630,72,350,312,22,24),...EYES.map(e=>geometry(e.x-e.rx,e.y-e.ry,e.rx*2,e.ry*2,3,3)),geometry(630,72,350,312,1,1)]
 const vaos:WebGLVertexArrayObject[]=[],buffers:WebGLBuffer[]=[];gl.useProgram(program)
 for(const mesh of meshes){
  const vao=gl.createVertexArray()!,buffer=gl.createBuffer()!;vaos.push(vao);buffers.push(buffer)
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STATIC_DRAW)
  const p=gl.getAttribLocation(program,'position'),u=gl.getAttribLocation(program,'uv')
  gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(u);gl.vertexAttribPointer(u,2,gl.FLOAT,false,20,12)
 }
 const uniforms=Object.fromEntries(['viewport','sceneTransform','angles','eyes','mode','original','mask','plate'].map(n=>[n,gl.getUniformLocation(program,n)]))
 let disposed=false
 const resize=()=>{const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr)}
 resize()
 return {resize,render(look:Look){
  if(disposed||gl.isContextLost())return
  const l=sceneLayout(innerWidth,innerHeight)
  gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program)
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA)
  gl.uniform2f(uniforms.viewport,innerWidth,innerHeight);gl.uniform3f(uniforms.sceneTransform,l.scale,l.offsetX,l.offsetY)
  gl.uniform2f(uniforms.angles,look.yaw,look.pitch);gl.uniform2f(uniforms.eyes,look.eyeX,look.eyeY)
  textures.forEach((t,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,t)})
  gl.uniform1i(uniforms.original,0);gl.uniform1i(uniforms.mask,1);gl.uniform1i(uniforms.plate,2)
  for(const mode of [3,0,1,2]){gl.uniform1i(uniforms.mode,mode);gl.bindVertexArray(vaos[mode]);gl.drawArrays(gl.TRIANGLES,0,meshes[mode].length/5)}
 },dispose(){
  if(disposed)return;disposed=true
  buffers.forEach(b=>gl.deleteBuffer(b));vaos.forEach(v=>gl.deleteVertexArray(v));textures.forEach(t=>gl.deleteTexture(t));gl.deleteProgram(program)
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT)
 }}
}
