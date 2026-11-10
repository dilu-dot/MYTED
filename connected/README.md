# TEDDY — hosted love story

Live website: https://teddy-v2.vercel.app/

Private owner login: https://teddy-v2.vercel.app/owner

## The experience

The panda intro opens the personal white letter. “There’s something more” continues to the six-photo story and the three answer buttons. Yes reveals the activity/date planner. Only explicit confirmation saves a plan; successful saving starts the cake-cutting scene, then returns to the first 3D page. The countdown can be paused. Reduced-motion preferences are respected.

The owner dashboard is behind a separate email/password login. It starts in a waiting state and shows the saved activity/day and celebration only after an acceptance. There is no owner link in visitor navigation. Knowing the URL does not grant access.

## Owner access

Use the existing site password from `%USERPROFILE%\.teddy-private\owner-access.txt`; this is not a Google password. No passwords or account secrets are in this repository or the release ZIP. Keep the local private configuration directory out of shared backups and source control.

## Hosted backend

Vercel serves the frontend and a same-origin API gateway. A Supabase Edge Function handles authentication and Postgres persistence. The Edge runtime receives its database keys from the platform; no database server key is sent to Vercel or the browser. The gateway replaces internal headers and passes only this app’s session cookies. Protected view data is transported as JSON and rendered at Vercel with the app’s content-security policy.

All four data tables use RLS and deny anonymous/authenticated direct access. The backend alone accesses them through its runtime key. Owner settings, the password verifier and private celebration design stay in the protected database. Preview and production have different gateway keys and separate data/session scopes. Sessions expire, use HttpOnly/Secure cookies, and are revoked on logout. Writes require same-origin and CSRF checks; login and saves have database-backed rate limits. Test responses have been removed from production.

## Source

- `intro/`: editable React panda/letter source and frames.
- `web/story/`: photo story, date planner and cake animation.
- `api/index.mjs`: Vercel API entry point.
- `backend/`: gateway, Edge handler, schema and regression tests.
- `private/`: local-only celebration template, excluded from public GitHub. The full private design is included in the owner’s downloadable source ZIP.
- `server.py`: offline/local SQLite version, retained without changing local responses.

## Build and check

From this connected directory:

```powershell
npm run install:frontend
npm run build
npm run check:frontend
npm run test:backend
npm run test:music
npm run preview
```

For a static `/MYTED/` subdirectory build, add `-- --base=/MYTED/` to build, check:frontend and preview. A static-only host cannot save responses or authenticate the owner. The public GitHub Pages entry redirects to the full hosted site instead.

The Vercel project uses this directory as its root, `npm ci --prefix intro` to install, `npm run build`, and `dist/` for public assets. Only the runtime gateway reads `TEDDY_GATEWAY_SECRET`, `TEDDY_BACKEND_URL` and `TEDDY_SITE_ORIGIN`. Values are managed in Vercel settings and are never prefixed with VITE_. The Edge function and protected settings were provisioned separately in the owner’s Supabase organization.

## Piano background music

The public intro, letter and photo story share a quiet 60-second original piano loop. Music loads on the first tap/click or supported keyboard interaction, fades in at low volume, and has a fixed keyboard-accessible mute control. The mute choice persists locally; the playhead follows the same tab between pages. Hidden tabs pause. Browsers that block resumed audio wait for another tap; full page navigation can cause a brief gap. The private owner page has no background music.

The self-hosted player and MP3 live in `intro/public/music/`. Vite includes them in the public build. `scripts/render-piano.py` is the optional authoring script (requires Python, numpy, scipy and ffmpeg), not a runtime dependency. The arrangement uses Alexander Holm's Salamander Grand Piano samples under CC BY 3.0; `music/credits.html` preserves attribution and lists the processing. No streaming service, tracking or runtime music subscription is used. `npm run test:music` covers activation, blocked autoplay, pending-play mute races, storage restrictions, page position and visibility.

## Local version

```powershell
python server.py --port 5191
```

An existing installation retains its saved owner account. On a fresh installation set TEDDY_OWNER_EMAIL first. This local version stores its SQLite database outside the webroot at `%USERPROFILE%\.teddy-private`; the hosted version uses Postgres and does not depend on this computer staying on.

## Verification

Frontend build/asset checks and hosted backend regression checks passed in GitHub Actions. Hosted API tests covered login, secure cookies, explicit saving, persistent owner reads, unauthorized-read rejection and logout. Browser checks covered the public intro/letter/photo routes and owner sign-in. See HOSTING-STATUS.md for release evidence. The Supabase project was quoted at $0/month; no paid plan upgrades were enabled.
