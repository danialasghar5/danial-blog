# Building a tool (contract)

Read with `TOOLS_ROADMAP.md` §8 (specs), §9 (architecture), §10 (testing, Definition of Done) and §11
(security). This file is the practical contract the foundation (`feat/tools-foundation`) provides.

## Files for a tool `<slug>`

```
src/content/tools/<slug>.mdx     frontmatter (registry entry) + the written guide (MDX body)
src/tools/<slug>/Widget.astro    markup + one <script> wiring inputs → logic → outputs
src/tools/<slug>/logic.ts        pure functions (no DOM, no window, no Date.now() without injection)
src/tools/<slug>/*.test.ts       node:test tests — every §8 test oracle, plus error paths
src/tools/<slug>/worker.ts       only when §10.3 requires it (large/untrusted text parsing)
src/tools/<slug>/fixtures/       sample inputs + *.expected.json (parsers)
```

Nothing else changes for a new tool. The hub, route, JSON-LD, breadcrumbs, result actions, recents and
CTA come from `ToolLayout` automatically.

## Frontmatter (schema: `src/content.config.ts`)

```yaml
---
title: 'Sidekiq Retry Schedule Calculator'        # H1 + card name
seoTitle: 'Sidekiq Retry Schedule Calculator — Every Retry Time'   # ≤ 60 chars
description: 'One sentence under the H1 and on the card.'
seoDescription: '140–160 chars, benefit + "runs in your browser".'
tier: signature            # or utility
group: jobs                # see src/data/tool-groups.ts
status: draft              # stays draft until the lead approves; drafts render nowhere
order: 10
featured: true
pubDate: 2026-11-26
keywords: ['sidekiq retry', 'retry_count', 'dead set']
versions: ['Sidekiq 7.x', 'Sidekiq 8.x']
relatedPosts: ['sidekiq-retry-strategy-transient-vs-permanent-failures']   # blog ids (filenames)
relatedTopic: background-jobs
nextTools: []              # leave empty; the lead wires chains at integration
serviceCta: jobs-audit     # signature only: jobs-audit | scaling | postgres-review
shareable: true
worker: false
faq:
  - q: 'Question?'
    a: 'Plain-text answer (rendered visibly AND as FAQPage JSON-LD).'
---
## How it works
...original guide (§14.4): how it works, worked example, limitations/versions, Rails angle...
```

Do not write the FAQ again in the body; the layout renders `faq` itself under "Frequently asked
questions".

## Widget contract

`Widget.astro` renders inside the instrument surface. The root element has `data-tool-widget`. After
every successful computation, dispatch **one** bubbling event from that root:

```ts
root.dispatchEvent(new CustomEvent('tool:result', { bubbles: true, detail: {
  text,          // plain-text version of the result (Copy result button)
  filename,      // optional: enables Download (e.g. 'recurring.yml')
  mime,          // optional, default text/plain
  state,         // optional: flat { key: string|number|boolean } for the share link (#v=1&…)
  cta,           // signature tools: true when the result meets the §8 CTA condition
  tone,          // 'ok' | 'risk' — colours the faceplate status dot
}}));
root.dispatchEvent(new CustomEvent('tool:clear', { bubbles: true, detail: {} }));        // inputs invalid/empty
root.dispatchEvent(new CustomEvent('tool:error', { bubbles: true, detail: { message } })); // announce an error
```

On load, read a shared link with `decodeHashState(location.hash, ALLOWED_KEYS)` and **re-validate every
value** with the same validators as typed input. Invalid values are ignored.

### Minimal widget skeleton

```astro
---
// Server-rendered markup only. Defaults are rendered into value="" so the page works before JS.
---
<div data-tool-widget>
  <div class="tool-fields two-col">
    <div class="tool-field">
      <label class="tool-label" for="retries">Retry count</label>
      <input class="tool-input" id="retries" name="retries" inputmode="numeric" value="25"
             aria-describedby="retries-error" />
      <p class="tool-error" id="retries-error"></p>
    </div>
  </div>
  <div class="tool-result" data-result hidden>
    <div class="tool-verdict" data-verdict role="status" aria-live="polite"></div>
    <div class="tool-table-wrap"><table class="tool-table" data-table></table></div>
  </div>
</div>

<script>
  import { parseNumberField } from '../_shared/validate';
  import { decodeHashState } from '../_shared/hash-state';
  import { compute } from './logic';
  const root = document.querySelector<HTMLElement>('[data-tool-widget]')!;
  // read inputs → validate → compute → render with createElement/textContent/replaceChildren
  // → dispatch tool:result. Debounce input events (~150 ms).
</script>
```

## Shared helpers (`src/tools/_shared/`)

| Module | Use |
|---|---|
| `validate.ts` | `parseNumberField`, `parseChoice`, `collect`, `checkSize`, `Result<T>` |
| `hash-state.ts` | `encodeHashState`, `decodeHashState` (state lives only in `#hash`) |
| `format.ts` | `formatNumber`, `formatPercent`, `formatDuration`, `formatDateTime`, `isValidTimeZone` |
| `worker-client.ts` | `createWorkerClient({ create, fallback, timeoutMs })` + worker message contract |
| `copy.ts` | `copyText` |
| `recent.ts` | used by the layout; widgets don't call it |
| `pg-locks.ts` | Postgres lock modes, table + row conflict matrices, log-name mapping |

### Worker pattern

```ts
// worker.ts
import { analyze } from './logic';
self.onmessage = (e: MessageEvent<{ id: number; payload: string }>) => {
  try { self.postMessage({ id: e.data.id, result: analyze(e.data.payload) }); }
  catch (err) { self.postMessage({ id: e.data.id, error: String((err as Error).message) }); }
};
// Widget <script>
const client = createWorkerClient({
  create: typeof Worker === 'undefined' ? null
    : () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
  fallback: analyze,
});
```

## CSS classes (`src/styles/tools.css`, already loaded by the layout)

`tool-fields` (`two-col`), `tool-field` (`stacked`), `tool-label`, `tool-hint`, `tool-input` (`wide`),
`tool-select`, `tool-textarea`, `tool-error`, `tool-actions-row`, `tool-result`, `tool-verdict`
(`is-ok` / `is-warn` / `is-risk`; put the verdict word in `<span class="state">`), `tool-metrics` →
`dl > div.tool-metric > dt + dd`, `tool-table-wrap` > `tool-table` (`td.num`), `tool-output` >
`tool-output-head` + `pre`. Buttons: global `btn btn-secondary btn-sm` / `btn btn-primary btn-sm`.
Use these instead of new colours or visual patterns (DESIGN.md). A widget may add a small scoped
`<style>` for layout only.

## Hard rules (security-check enforces most of them)

- **No `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, and
  no `set:html`.** Build DOM with `document.createElement`, `textContent`, `replaceChildren`, `append`.
- **No network calls.** No `fetch`, XHR or WebSocket. Everything runs in the page.
- **Validate every input** (typed, pasted, or from the hash). Never show `NaN`, `Infinity`,
  `undefined` or a stack trace: test that.
- **Erasable TypeScript only** (Node runs tests by stripping types): no `enum`, no `namespace`, no
  constructor parameter properties, no `import x = require()`. Use `as const` unions.
- **Import with explicit `.ts` extensions inside `logic.ts` and tests** (`import { x } from './parse.ts'`),
  because Node resolves files literally. In `Widget.astro` `<script>`, extensionless imports are fine.
- **Never write the JavaScript escape for U+2028 or U+2029 (backslash-u-2028) into a file.** The editing tool turns it into the raw separator character, which breaks JS strings and regexes. Use `String.fromCharCode(0x2028)` instead.
- **Determinism:** no randomness in outputs. Inject `now: Date` and the time zone into logic functions.

## Commands (Node 22.23.5: `source ~/.nvm/nvm.sh && nvm use 22.23.5`)

```
npm ci                      # once per worktree
npm test                    # node --test --experimental-strip-types "src/**/*.test.ts"
npx astro build             # build must pass (registry assertions run here)
node scripts/seo-regression.mjs           # must stay "all 25 protected URLs unchanged"
node scripts/security-check.mjs --no-audit
```

`security-check` currently reports 2 known failures (no `/*` headers, no CSP yet; task S0-4). Any
*other* ✕ is yours to fix.

To see the page while developing, temporarily set `status: live` and run `npx astro dev --port <n>`,
then **set it back to `draft` before committing**. A live tool must have a `Widget.astro`, and its
`relatedPosts` must be published posts, or the build fails.
