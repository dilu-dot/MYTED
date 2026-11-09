# Hosted release verification

Website: https://teddy-v2.vercel.app/
Owner: https://teddy-v2.vercel.app/owner

The frontend and hosted backend are deployed. Production API checks passed for health, Secure/HttpOnly visitor cookies, explicit confirmation, persistent saved-plan reads through owner authentication, private-view rendering and server-side logout. Direct anonymous reads of database settings/plans return 401; all four tables have RLS enabled and direct visitor grants revoked. Advisors show only informational no-policy findings for intentionally server-only tables.

A disposable production API test response was saved, read back through the owner API, and removed using its exact hashed visitor identifier. Production then had zero plans. Local responses were not migrated, changed or deleted. Separate test-environment data was also removed.

The live owner login was exercised in the browser with the existing password. The private waiting state rendered correctly, its API loaded, and no browser error/warning was captured. The public intro, letter-to-photo navigation, mobile layout and cake return had previously passed frontend/browser checks. Hosted transport fixes for provider cookies and Edge HTML sandboxing are covered by regression tests.

The old GitHub Pages entry is being replaced by a redirect to the complete hosted app. Secrets and the private page template remain excluded from public GitHub. Source ZIPs include the private design but omit credentials, saved responses and cloud settings.
