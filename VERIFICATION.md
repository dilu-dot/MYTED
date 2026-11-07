# Verification — current Phase 1 preview

Verified on 2026-11-07 in the connected desktop browser using the included browser self-check suite. The production TypeScript/Vite build passes.

## Current behavior

- The large heart has been removed. The ending is a completely blank white viewport; intro canvases clear and stop drawing there. Reverse scrolling restores the scene.
- All 192 supplied frames scrub forward and backward. An eased playhead blends neighboring frames, with a gentle camera push. Native scroll input remains available.
- All lightweight playback frames are prepared before loading completes. A bounded detail cache restores sharper frames at rest. The measured decoded bitmap cache was 109.8 MiB / 198 bitmaps, below the 128 MiB limit.
- A rapid-scroll sample produced 24 distinct fractional frame positions in 24 observations. Fluid GPU work pauses during scrolling and resumes on subsequent pointer input after settling.
- Teddy's head and separate eyes follow the pointer only at the top. Last-look hold, pointer-exit return, neutral handoff and reverse-scroll reactivation pass. No character idle loop runs.
- The background animates without mouse input while Teddy remains still. Its mask protects the character; it fades and clears before white.
- The official WebGL fluid engine renders the configured rose/ivory palette, including click splashes. No old spotlight remains.
- The particle vortex restores the original greeting mask with 0.0000% difference in the sampled test; all 1,319 sampled dots remain.
- Controls stay clickable. Resizing and high-DPI backing buffers work. Touch-only and reduced-motion tests allocate no fluid WebGL resources.
- No JavaScript/React errors or console warnings were reported in the completed browser checks.

## Performance sample

Desktop requestAnimationFrame intervals in the completed suite:

| Sample | Median | 95th percentile |
|---|---:|---:|
| Baseline | 16.7 ms | 16.9 ms |
| Active fluid | 16.7 ms | 16.9 ms |

Adaptive quality remained high in this run. These measurements are specific to the tested browser/device and do not guarantee the same timing on every computer. The atmosphere draws at a lower rate during scrolling; high-detail frame decoding waits until motion stops.

StrictMode cleanup matched all tracked creations and deletions: 144 programs, 158 shaders, 142 textures, 26 vertex arrays, 26 buffers and 130 framebuffers. Event listeners and animation loops also passed disposal checks.

## Snapshot and source integrity

Before the earlier background/ending edits, the project was copied to the separate TED001 directory and ZIP. All 420 snapshot files were SHA-256 verified. That frozen backup is kept outside this repository. The working project's 192 supplied JPG assets remain unchanged.

## Verification limits

Standalone Edge automation could not launch its Windows temporary profile in the sandbox. The full browser self-check suite passed in the connected browser instead. Touch/reduced-motion behavior was checked through browser tests; no physical phone was used.

The supplied assets are 192 JPGs. A separate 35-second video and particle-reference recording were not present, so their exact timing/motion parity cannot be independently verified. Teddy uses a limited-angle, source-textured 2.5D rig rather than a complete 3D model.

Scope remains Phase 1. The separate six-chapter HTML is not integrated. No hosting deployment is part of this change.
