export const FRAME_COUNT = 192
export const LETTER_REVEAL_PROGRESS = .95
export const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n))
export function smoothstep(start: number, end: number, progress: number) {
  const t = clamp((progress - start) / (end - start))
  return t * t * (3 - 2 * t)
}
export const cursorOpacity = (progress: number) => 1 - smoothstep(0.8, 0.95, progress)
export const paperOpacity = (progress: number) => smoothstep(0.87, 0.95, progress)
export const greetingOpacity = (progress: number) => 1 - smoothstep(0.18, 0.34, progress)
export const frameAt = (progress: number) => Math.round(clamp(progress / 0.94) * (FRAME_COUNT - 1))
// .1 means 10% of the remaining distance per 60 Hz frame, independent of refresh rate.
export const damping = (smoothing: number, deltaMs: number) =>
  1 - Math.pow(1 - clamp(smoothing, 0.01, 1), deltaMs / (1000 / 60))
