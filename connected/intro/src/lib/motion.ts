// Motion stays enabled on every visit, including after an older saved toggle.
export function motionReduced(_systemReduced?: boolean) {
  return false
}
export function subscribeMotion(_listener: () => void) {
  return () => {}
}
