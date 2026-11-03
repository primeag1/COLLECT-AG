# Contributing

## Development setup

1. Install Node.js 22 and npm.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local` and configure a Google OAuth client ID
   for local development when testing Drive features.
4. Run `npm run dev`.

## Before opening a pull request

Run the same checks as CI:

```sh
npm run lint
npx tsc -b
npm test
npm run build
npx playwright install chromium
npm run test:a11y
```

Keep changes focused, add tests for behavior changes, and never commit
credentials, access tokens, or real user data.
