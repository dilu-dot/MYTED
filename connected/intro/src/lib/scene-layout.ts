export const SOURCE_WIDTH=1280, SOURCE_HEIGHT=720, SOURCE_TOP=42, SOURCE_CONTENT_HEIGHT=636
export function sceneLayout(width:number,height:number){
  const portrait=width/height<.9
  const scale=portrait?width/SOURCE_WIDTH:Math.max(width/SOURCE_WIDTH,height/SOURCE_CONTENT_HEIGHT)
  return {scale,offsetX:(width-SOURCE_WIDTH*scale)/2,offsetY:portrait?(height-SOURCE_CONTENT_HEIGHT*scale)*.51:(height-SOURCE_CONTENT_HEIGHT*scale)/2}
}
export function sourceToScene(x:number,y:number,width:number,height:number){
  const l=sceneLayout(width,height)
  return {x:l.offsetX+x*l.scale,y:l.offsetY+(y-SOURCE_TOP)*l.scale,scale:l.scale}
}
