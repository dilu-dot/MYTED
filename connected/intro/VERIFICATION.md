# Verification - direct letter handoff

Verified locally on 2026-11-09. This local update has not been committed, pushed or deployed.

## Current behavior

The extra blank viewport and large white spacer are removed. The confession section overlaps the last viewport of the cinematic and becomes visible at 95% progress, exactly when the existing paper layer becomes fully white. The greeting is already in the viewport at this point; no extra swipe or automatic scrolling is required.

The overlap is recalculated on resize and ScrollTrigger refresh using the scene's actual height. The same single cinematic pin, 192-frame sequence and original source assets are retained. Skip intro lands at the first letter view, with rounding that reaches the handoff threshold reliably.

## Checks

- TypeScript and production build pass. The confession/motion chunk is 49.25 kB gzip; intro entry is 140.70 kB gzip.
- The desktop browser suite passes: no confession before the opening completes, greeting visible at the handoff with no further scroll, no automatic scroll, letter-by-letter timing, intact emojis, all six exact paragraphs sharp and readable, no horizontal overflow, reverse playback, offscreen loop pause, a visible second blur/reveal cycle, static reduced motion, and synchronous pin cleanup.
- The 390 x 844 reduced-motion suite passes the direct-handoff, text, layout, reverse-scroll and cleanup checks. No physical phone was used.
- The built phone preview was inspected using Skip intro without any subsequent scrolling: progress 0.95024, greeting top 128px, and the letter visible immediately. Browser error/warning log was empty.
- The repeating letter-by-letter effect and stationery design are retained. Visible blocks hold sharp for five seconds before the next blur/reveal; hidden/offscreen blocks stop looping. Reduced motion stays static.
- Lint has no errors; imported animation-source ref/effect advisories remain.

## Scope

No second ScrollTrigger, wheel interception, automatic advance, six-chapter HTML, proposal-choice screen or date selector was added. The eight original intro implementations retain their behavior; animation.ts adds only the shared letter threshold, while App.tsx adds continuation positioning and the adjusted Skip intro destination.

All 192 supplied JPGs remain unchanged. The prior complete intro suite verified pointer-only Teddy interaction, particle restoration, rose/ivory fluid, reversible scrubbing and GPU disposal. The separate original video and particle reference recording were not provided, so exact motion/timing parity cannot be independently checked. TED001 remains a separate frozen backup.

The connected-browser suites were used because standalone Edge automation previously could not launch its temporary Windows profile in this sandbox. Reports and screenshots are saved in the outputs directory alongside the project.
