<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Do not drive a browser

Never use Playwright, Puppeteer, Selenium, or any other headless browser to
verify work in this project. No screenshots, no scripted clicks, no
`page.fill`, no `pressSequentially`.

The user checks the app in a real browser, and that check is the one that
counts. Scripted runs have cost more time than they have found here: they
have failed to hydrate for reasons that had nothing to do with the change
under test, which made a passing feature look broken and sent the work into
a debugging loop that had no defect at the end of it.

Verify with `npx tsc --noEmit` and `npm run build`. Call an API route with
`curl` or `node` when a request needs exercising — that is fine, and it is
how the model-facing endpoints were tested. Stop at the browser boundary.

Two more things that follow from the same preference:

- Do not print Bangla to the terminal. It renders as broken boxes. Write to a
  file and assert on it instead, or check for the Unicode range.
- Do not commit to a verification phase the user did not ask for. If they
  say a change works, take that as the answer and get back to building.
