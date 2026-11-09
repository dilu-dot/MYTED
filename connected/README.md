# TEDDY — connected local website

The existing 3D panda intro and personal white letter now lead to the approved six-photo story, glowing answer buttons, and date planner. At the end of the original letter, **There’s something more** opens `/story/` on the same server.

## Open

- Website: http://127.0.0.1:5191/
- Your private space: http://127.0.0.1:5191/owner
- Owner account: the email configured on your first server start.
- Your generated private password is in `%USERPROFILE%\.teddy-private\owner-access.txt`. This is a separate site password, **not your Google password**. Keep that file private. It is not in the public website or ZIP.

Run with Python 3.11 or later, with no additional Python packages:

```powershell
$env:TEDDY_OWNER_EMAIL = 'your-email@example.com'
python server.py --port 5191
```

Set the email only on a fresh installation. Existing installations keep the account already saved in their private database; changing an environment variable cannot replace it. The server defaults to loopback only. Keep it running while using the preview. This implementation is local; it has not replaced the Vercel deployment or created a public sharing URL. A static host or `python -m http.server` cannot run the protected dashboard or save responses.

## What happens

The date section appears when she selects Yes. It explains that confirmation shares her yes, activity and day with Rizwan. Only **Confirm our little plan** submits the response. No email, booking, message or background tracking is sent. Time/friends choices remain ordinary respectful notes.

Your dashboard starts with a waiting state. After a confirmed acceptance it shows the latest chosen date, activity, confirmation time, India-time countdown, and animated gold stars and hearts. It refreshes every 15 seconds while visible. The preview screenshot uses isolated **sample data**, not a real answer.

## Privacy and persistence

The server validates the exact owner email and a generated high-entropy password, stored as a salted scrypt hash. Sessions expire after 12 hours, use random tokens stored hashed in SQLite, and travel in HttpOnly/SameSite Strict cookies. Login is rate limited; writes require same-origin requests and CSRF tokens. Sign-out invalidates the session on the server. Only the public `web/` directory is served. Private templates, source, passwords and the database cannot be downloaded through static URLs.

The `/owner` route has no visitor navigation link. Knowing the URL only reveals the sign-in page. The celebration HTML and saved responses require authentication. Authentication is an email-and-password allowlist; it does not claim to verify a Google identity or send magic-link emails.

SQLite and credentials live outside the webroot at `%USERPROFILE%\.teddy-private`. Changes survive server restarts; duplicate confirmations from the same browser session update its plan. Back up that directory privately; deleting it loses saved plans and creates new credentials. Other people with administrator access to this computer can access local files. Do not share the password or an already signed-in browser profile.

## Hosting later

Public deployment needs a Python-capable host, persistent disk for SQLite, and HTTPS. Remote binding is rejected unless an explicit HTTPS `--origin` is provided. A trusted reverse proxy must enforce TLS and the configured host; remote cookies then use Secure. Vercel's current static deployment does not run this Python HTTP server and must not receive a database on ephemeral disk. No cloud costs or project settings were changed. For a Vercel deployment, migrate persistence and owner authentication to a managed backend first.

## Source and rebuilding

- `intro/src/` preserves the existing panda, splash cursor, particles, repeating letter blur and motion settings. Only the end-of-letter continuation and its CSS were added.
- `web/` is the built intro plus the editable static photo app at `web/story/`.
- `templates/login.html` contains the sign-in screen. The celebration design in `private/celebration.html` is included only in your local full ZIP, and is excluded from the public GitHub push. A repository-only checkout returns 503 after authentication until this private template is supplied; it never bypasses authentication. You can keep templates elsewhere using `TEDDY_PRIVATE_TEMPLATES`.
- `server.py` owns authentication, validation and persistence.

To rebuild the intro: run `npm install`, then `npm run build` from `intro/`; copy `intro/dist/` into `web/` without removing `web/story/`. The local checkout uses an existing dependency directory through a junction; the source ZIP excludes all dependencies, credentials and databases.

## Verification

```powershell
python test_server.py
```

Tests use a temporary database and credentials. They check unauthorized reads, private file access and traversal, incorrect email, cross-origin rejection, cookies, missing CSRF, invalid dates/activities, duplicate confirmation, persistence after restart, and session invalidation after logout.

Browser verification covered the actual letter link, the full sample acceptance flow, private waiting-to-celebration transition, sign-out, and a 390px phone viewport with no horizontal overflow. Build passed. Lint completed with eight inherited React warnings in the existing blur/splash components; no new lint errors. Actual phone hardware, public hosting and email notifications were not tested or configured.

## Pre-push review — 9 November 2026

Fixed non-canonical compact/week dates accepted by Python but unreadable by the dashboard. The API now accepts only YYYY-MM-DD. Locked date controls during submission, captured an immutable selection before the first request, and restored their original disabled states on success or failure. The confirmation and optional share message now describe the exact saved selection.

The public repository intentionally excludes the private celebration template, preview, generated passwords, databases, dependencies and environment files. The full local ZIP contains the design but no credentials or saved responses. The existing owner email is loaded from the private database rather than hardcoded in public source.

Delayed-save browser regression: a forced failure restored activity/calendar buttons and preserved past-day restrictions; retry saved the exact new selection and displayed matching confirmation. See VERIFICATION.md.

## Cake celebration

After the server confirms a saved date, the visitor sees an illustrated cake-cutting animation, confetti and “Here our journey begins.” A ten-second countdown returns to the first 3D scene at `/?journey=beginning`. “Stay a little longer” pauses both the animation and countdown; the countdown also pauses in hidden tabs. Reduced-motion mode displays the cake without animation. A direct return link and Escape also return to the opening. Failed saves never begin the celebration. The private owner celebration is separate.
