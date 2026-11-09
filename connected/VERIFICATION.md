# Verification

The current release evidence is in HOSTING-STATUS.md. Prior frontend and local-server checks were completed before hosting; the hosted backend now uses Postgres persistence and a first-party gateway. The Python local server remains available separately.

Run npm run check:frontend after building and npm run test:backend for regression checks. Tests cover source/build routes and assets, private owner access, date validation, CSRF, duplicate confirmation, scope isolation, cookie filtering and protected-view transport/rendering.
