# MYTED — TEDDY V2

A Phase 1 cinematic React experience: interactive Teddy → scroll-controlled letter opening → expanding paper → a clean fullscreen white page.

The large heart ending has been removed. This repository contains the current working site; the separate TED001 backup is kept outside it.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev -- --port 5188 --strictPort
```

Open http://127.0.0.1:5188/ . Scroll to unfold the scene and scroll backward to reverse it. The Teddy wordmark returns to the beginning; **Skip intro** moves to the white ending.

```sh
npm run build
npm run preview -- --port 5189
```

Production output is generated in `dist/`. Serve it over HTTP.

## Interaction

- At the very top, the layered 2.5D Teddy follows the mouse with its head and separate eyes. Body and paws remain anchored. There is no character idle loop.
- Scrolling disables tracking, returns the head to its original pose, then advances the image sequence. Returning to the top re-enables tracking after the sequence settles at frame zero.
- The two-line particle greeting reacts locally to the pointer and reconstructs its original dots. It fades before the letter opens.
- Rose ribbons and sparse light points animate behind the character, with a protective mask over the doll.
- The official React Bits SplashCursor uses a rose/ivory palette. It pauses its GPU work during scrolling and resumes on subsequent mouse movement after scrolling settles.
- Intro effects fade and clear before the fullscreen white ending. No heart or other mark remains there.

The normal page respects reduced motion and touch-only devices. To explicitly review full motion while the device requests reduced motion, open `/tests/particle-preview.html` and click **Enable motion preview**. This development-only route does not ship in the production build or change system settings.

## Smooth playback

ScrollTrigger reads native scroll input; a short, time-corrected eased playhead drives rendering. Neighboring prepared frames blend between integer frame positions, with a small scroll-driven camera push. Wheel, trackpad, scrollbar, touch and keyboard input retain native behavior; no wheel interception is used.

All 192 lightweight playback bitmaps are prepared before the loading indicator completes, preventing repeated JPEG decoding during fast scrubs. A small full-detail cache restores sharper detail after motion stops. Decoded bitmap memory is capped at 128 MiB, and evicted/unmounted bitmaps are closed.

Canvas backing buffers are capped to avoid unnecessary retina/4K work. The atmosphere uses a smaller buffer and reduces its drawing rate during scrolling. Fluid mask geometry is measured on resize rather than every playhead update. The fluid simulation is suspended while the cinematic is moving, leaving rendering time for frame playback.

Reduced-motion mode uses direct scrub, without fractional frame blending or camera motion, and static decorative content.

## Structure

- `src/App.tsx`: native-scroll input, eased playhead, subframe rendering and scene transitions.
- `src/lib/frame-source.ts`: compressed assets, prepared playback bitmaps and bounded full-detail cache.
- `src/components/ui/interactive-teddy.tsx` and `src/lib/teddy-rig.ts`: curved source-textured head rig, eye layers and reversible handoff.
- `src/components/ui/particle-typography.tsx`: sampled glyph dots and localized vortex physics.
- `src/components/ui/splash-cursor.tsx`: official React Bits WebGL fluid engine with application lifecycle/quality hooks.
- `src/components/ui/scene-splash-cursor.tsx`: scene visibility, masks and scroll budget integration.
- `src/components/ui/cinematic-atmosphere.tsx`: lightweight animated background.
- `public/frames/`: the 192 original supplied JPGs, unchanged.

## Checks

```sh
npm run build
npm test
```

The Playwright suite uses installed Microsoft Edge. For the connected-browser self-check suite, open `/tests/browser-checks.html` and click **Run browser checks**. It checks real canvas/WebGL output, subframe motion, memory limits, forward/reverse playback, pointer-only behavior, white-page cleanup and resource disposal.

Current measured results and verification limits are in [VERIFICATION.md](VERIFICATION.md).

## Assets and credits

The panda assets are the supplied 192-frame sequence. A separate 35-second source video and the separate particle-reference recording were not present, so their exact timing/motion parity cannot be independently verified from this repository. The Teddy rig is a limited-angle, front-facing 2.5D relief rather than a complete 3D model.

SplashCursor comes from the [official React Bits registry](https://reactbits.dev/r/SplashCursor-TS-TW.json). Its GLSL solver is retained; license and provenance are in `licenses/`.

The project uses React, TypeScript, Vite, Tailwind and GSAP ScrollTrigger, with shadcn-compatible `@/` aliases and `src/components/ui` organization. It does not include the separate six-chapter TEDDY HTML.
