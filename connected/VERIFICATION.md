# Pre-push verification — 9 November 2026

- GitHub repository verified: dilu-dot/MYTED; default branch main, head 42407deaadda0e6ef805fb6ca1a41d557fe1a912 at review start. No AGENTS.md in the remote source tree.
- Production intro build: passed, 464 modules. The existing eight React lint warnings remain in blur/splash components; no lint errors.
- Python integration checks: passed. Canonical YYYY-MM-DD validation now rejects compact dates and ISO week-date strings. Unauthorized API/template requests, login, CSRF, duplicate confirmation, persistence across restart, missing private template and logout are covered.
- Browser failure/retry test: isolated server delayed saves by four seconds and returned a test 503 on the first attempt. Activity/calendar controls locked while saving. After failure they recovered, past days remained disabled, and no success dialog appeared. Retrying with Ice cream / 13 November 2026 saved precisely that choice; the visible confirmation and SQLite row matched.
- The real database remained empty; sample responses were stored separately under work/.
- No cloud deployment or main-branch update was performed during verification.

The private celebration design/preview, credentials, data and environment files are excluded from the public GitHub tree. The full downloadable ZIP includes the private design, without credentials or saved answers.

## Cake continuation check

JavaScript syntax and backend integration checks passed. An isolated browser confirmation saved Coffee / 12 November 2026, then opened the cake scene. Computed SVG styles confirmed the animated separated slice and knife animation. Desktop and 390px phone layouts had no horizontal overflow. Pause kept the scene open; resume returned automatically to `/?journey=beginning`, with scrollY=0 and scene progress=0.00000. No console errors or warnings were captured. Sample data was isolated from the real owner database.

## Frontend / GitHub Pages check

- Local server was stopped; restarted on 127.0.0.1:5191.
- Current GitHub Pages site inspected in browser: empty React root; script URL https://dilu-dot.github.io/src/main.tsx. The only existing Pages workflow run was for old main SHA 42407deaadda0e6ef805fb6ca1a41d557fe1a912, not the connected branch.
- Added a complete frontend build, static preview and deployment-asset validation. Root build and /MYTED/ build both passed, including all 32 static asset/route references and checks excluding owner/server files.
- Browser tested /MYTED/ intro → letter → photo story. All six modal positions, both respectful alternative answers and missing-date validation worked. 390px layout had no horizontal overflow.
- Static-only preview: unavailable API produced a recoverable connection message, left controls enabled, and did not show a fake cake success.
- Isolated subpath fixture: successful sample save displayed the cake, then automatically returned to /MYTED/?journey=beginning with scrollY=0 and scene progress=0.00000. No real response was submitted by this check.
- Backend source, private credentials, saved answers, main branch and live deployment were not changed.

## Hosted backend preparation

Core and gateway regression checks pass: owner-only reads, password verification, Secure/HttpOnly cookies, same-origin/CSRF checks, invalid dates, duplicate confirmation, session persistence and environment isolation. The hosted Edge API test passed health, actual saved-plan storage, authenticated owner reads and rejection of visitor reads in a separate test environment. All four data tables have RLS enabled; anon and authenticated roles have no SELECT privileges on plans or settings. Security advisors report only informational no-policy findings, intentional for these server-only tables.
