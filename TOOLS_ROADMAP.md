# Developer Tools Hub — Master Roadmap

> The master plan for turning `danialasghar.com/tools/` into a developer tools hub. It sits alongside the
> technical blog and consulting services and does not replace them.
>
> **Status:** Approved strategy, pre-implementation. No phase started.
> **Created:** 2026-11-26 · **Owner:** Danial Asghar
> **Branch of record:** `docs/tools-roadmap`, branched from `feat/premium-redesign` at `ed84151`.
>
> Work proceeds one phase at a time. When a phase ends, it is reviewed and approved before the next one
> starts. Update §0 (status) and §17 (decision log) whenever something changes.

---

## Table of contents

0. [Status tracker](#0-status-tracker)
1. [Permanent project rules](#1-permanent-project-rules)
2. [Vision and strategy](#2-vision-and-strategy)
3. [Research record](#3-research-record)
4. [Goals and priority order](#4-goals-and-priority-order)
5. [Taxonomy: tiers, groups, URLs](#5-taxonomy-tiers-groups-urls)
6. [Tool inventory, summary table (47 tools)](#6-tool-inventory--summary-table-47-tools)
7. [Tool specifications (all 47)](#7-tool-specifications-all-47)
8. [First five tools: implementation specifications](#8-first-five-tools--implementation-specifications)
9. [Architecture](#9-architecture)
10. [Frontend, logic, Web Workers, testing](#10-frontend-logic-web-workers-testing)
11. [Security, privacy, browser-only processing](#11-security-privacy-browser-only-processing)
12. [Discovery experience](#12-discovery-experience)
13. [Cross-promotion and internal linking](#13-cross-promotion-and-internal-linking)
14. [SEO, structured data, indexing, content requirements](#14-seo-structured-data-indexing-content-requirements)
15. [Future AdSense strategy](#15-future-adsense-strategy)
16. [Phased roadmap (Phase 0 – Phase 4)](#16-phased-roadmap-phase-0--phase-4)
17. [Decision log](#17-decision-log)
18. [Assumptions register](#18-assumptions-register)
19. [Open decisions and blockers](#19-open-decisions-and-blockers)
20. [Appendices](#20-appendices)

---

## 0. Status tracker

| Phase | Name | Status | Branch | Approved |
|---|---|---|---|---|
| — | Strategy and roadmap (this document) | ✅ Written | `docs/tools-roadmap` | Strategy approved 2026-11-26 |
| 0 | Prep: merge redesign, baseline data, keyword validation | 🔄 In progress: redesign merged (D1, D2 ✅), SEO baseline done (`607422d`), security plan added (§11, S0-1 to S0-8); waiting on D3, D4 and the S0 tasks | `chore/seo-baseline` | — |
| 1 | Foundation and first five tools | ⏳ Not started | `feat/tools-foundation`, then `feat/tool-<slug>` | — |
| 2 | Signature depth and first utilities | ⏳ Not started | — | — |
| 3 | AI, Rails runtime and the utilities batch | ⏳ Not started | — | — |
| 4 | Long tail | ⏳ Not started | — | — |

Per-tool status is in the `Status` column of §6. Values: `planned`, `in-progress`, `live`, `dropped`.

---

## 1. Permanent project rules

These rules apply to every phase. A rule changes only when the owner explicitly says so, and the change
is recorded in §17.

### 1.1 Quality

1. **Every tool is fully functional.** UI prototypes, placeholder outputs and "coming soon" pages are never
   shipped or indexed.
2. **Validation, error handling, accurate calculations and automated tests are required.**
   - Every input is validated, and errors are shown inline next to the field (see §10.4).
   - Every calculation or parse has automated tests, checked against known reference values (§10.6).
   - If a tool depends on version-specific behaviour (Sidekiq, Rails, Postgres), it states which versions
     it targets on the page, and the tests cover each of them.
3. **Finish the first five tools completely before starting the next batch.** "Complete" means the
   Definition of Done in §10.8 for all five.
4. **A tool never launches without its explanatory content** (§14.4). The widget and the written content
   ship together.

### 1.2 Design and experience

5. **The approved redesign (`feat/premium-redesign`, `DESIGN.md`) is the visual foundation.** That means
   its tokens, type, the One Ruby Rule, inputs, the Tool Verdict strip and share cards. Tools add no new
   visual language unless `DESIGN.md` is updated first.
6. **Discovery should feel polished and professional, modelled on iLovePDF and adapted for developers**
   (§12).
7. **Light and dark themes are both complete, and the site meets WCAG 2.2 AA**, including tool results,
   code output and charts.
8. **No dark patterns, no popups, no interstitials.** This follows `PRODUCT.md` principle 4.

### 1.3 Architecture

9. **The architecture must scale to all 47 planned tools and to future additions**, via a content
   collection, a single dynamic route, a shared layout, and one folder per tool (§9).
10. **All tools run in the browser by default.** A tool that needs a server needs an explicit decision in
    §17 first.
11. **Every tool lives under `danialasghar.com/tools/`**, unless a decision recorded in §17 says otherwise.

### 1.4 Protecting what already exists

12. **Existing blog URLs, content, frontmatter, SEO metadata, structured data and rankings are protected.**
    - No existing URL changes: `/blog/*`, `/topics/*`, `/projects/*`, `/services/`, `/about/`,
      `/contact/`, `/privacy/`, `/tools/`, `/tools/connection-pool-calculator/`.
    - No change to an existing page's `<title>`, meta description, canonical or JSON-LD unless the owner
      approves that specific change.
    - Every phase runs the SEO regression check (§14.8) before it can be approved.
13. **The blog post frontmatter schema is not touched.** Links between tools and posts live in the tool
    entries (§9.3).

### 1.5 Monetization

14. **No AdSense or advertising scripts yet.** Not in any phase until the AdSense decision gate in Phase 3
    (§15, §16) is explicitly approved.

### 1.6 Git and process

15. **All work happens on feature branches with clear names**: `feat/tools-foundation`,
    `feat/tool-<slug>`, `docs/<topic>`, `fix/tool-<slug>-<issue>`.
16. **Pushing and merging.**
    - **Standing permission (owner, 2026-11-26, DEC-16):** once a branch is finished and verified
      (tests, `seo:check`, `security:check`), it may be fast-forwarded or merged into `main` and pushed.
      Local `main` is then updated from `origin/main`.
    - Still needs explicit permission each time: force pushes, rewriting history on `main`, deleting
      branches, pushing unfinished work, and anything that changes live security headers for the first
      time (HSTS in particular, §11.4).
17. **Git identity:** `Danial <danialasghar5@yahoo.com>`. State the author before every commit.
18. **One concern per commit.** Unrelated files never go into a commit.
19. **Existing work is preserved.** Never discard or overwrite uncommitted changes, stashes or backup
    branches (`backup/premium-redesign-before-split`, `stash@{0}`).

### 1.7 Security (site-wide: blog, tools, build pipeline, infrastructure)

20. **Security headers apply to every route** (`/`, `/blog/*`, `/topics/*`, `/tools/*` and all other
    pages), not only to tools. The required set is in §11.4. A change that would drop or weaken a header
    fails `security:check` (§11.10).
21. **No `'unsafe-inline'` or `'unsafe-eval'` in `script-src`.** Inline scripts are allowed only with a
    SHA-256 hash in the CSP (§11.5).
22. **No dynamic code or HTML from untrusted data**, in blog components and tool widgets alike:
    - no `eval()`, `new Function()`, or string arguments to `setTimeout` / `setInterval`
    - no `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write`
    - `set:html` only for build-time, author-controlled content on the §11.6 allowlist

    Enforced by `security:check`.
23. **Third-party scripts:** none, apart from the Cloudflare Web Analytics beacon (§11.5). Any external
    script needs Subresource Integrity (SRI) and a pinned version, or a recorded exception in §17.
24. **Supply chain** (§11.7):
    - installs use `npm ci` against the committed lockfile
    - `npm audit --audit-level=high` must pass
    - dependency updates come through automated PRs with a cooldown
    - runtime dependencies stay minimal, with no UI framework
25. **Secrets never reach the client.**
    - `PUBLIC_*` variables are public by definition and may only hold public identifiers (e.g. the
      analytics beacon token).
    - Tokens, API keys and credentials never go in `PUBLIC_*`, in the repo or in `dist/`.
26. **Accounts and infrastructure are hardened and checked every phase** (§11.8–§11.9):
    - passkey or hardware-key 2FA on Cloudflare, the registrar and GitHub
    - DNSSEC and registrar lock
    - TLS mode Full (Strict)
    - WAF managed rules
    - branch protection
    - least-privilege deploy tokens

---

## 2. Vision and strategy

### 2.1 Vision

`danialasghar.com` grows into **a comprehensive developer tools hub sitting alongside the technical blog
and consulting practice.** It has two kinds of tools:

- **Signature tools.** Tools only a Rails, Postgres and background-job reliability specialist would build.
  They prove expertise, earn links, and lead naturally to the consulting offers.
- **Developer utilities.** Broad, high-demand utilities such as JSON, JWT, cron, regex and timestamps.
  Developers use them every day. They are written in Danial's voice with a Rails or Ruby angle, and they
  bring in organic traffic.

### 2.2 Strategic decisions (approved 2026-11-26)

| # | Decision | Rationale |
|---|---|---|
| S1 | **Hybrid hub on the main domain under `/tools/`.** Not a subdomain, not a separate domain | Inherits the domain's authority. $0 hosting. One design system. Tools strengthen the brand |
| S2 | **Admit a broad tool only if it passes all three tests** (§2.3) | Keeps volume without diluting the brand |
| S3 | **No consumer tools (PDF, image, general text) on this domain.** If they are ever built, they go on a separate domain from day one | Different audience, crowded market, server costs. Moving pages to a new domain later loses ranking value |
| S4 | **Signature tools are featured; utilities sit visually second** | The brand still reads as a Rails reliability engineer with good utilities |
| S5 | **Goal order: consulting leads now → organic traffic as the engine → AdSense later, only on low-intent pages** | Highest value per visitor first. Each goal funds the next (§4) |
| S6 | **Everything runs in the browser** | No retention liability, a strong privacy promise, $0 infrastructure |

### 2.3 The three admission tests for a general utility

A utility belongs on the site only if it passes **all three**:

1. **Same audience.** Its users are developers, the same people who read the blog.
2. **Original explanation possible.** It can carry original writing in Danial's voice, with a Rails or
   backend angle and a real worked example. This is what makes the page rank, and what Google requires
   before it counts a page as having content.
3. **Runs in the browser.** No uploads, no server, no retention.

These pass: JSON, JWT, cron, regex, timestamps, UUIDs, SQL formatting, YAML, diff, HTTP headers, CSP and
CIDR tools.

These fail: PDF merge, compress and convert, image editing, meme makers, word counters, resume, invoice
and QR generators.

### 2.4 Should the tools platform be the main brand?

No. The tools exist to **demonstrate expertise**, not to become an iLovePDF-style utility business. Every
signature tool should make a reader think "this person understands my production problem." Utilities make
the site a place developers come back to.

---

## 3. Research record

This section preserves the findings so the research does not need repeating. Labels: **[V]** = verified,
**[A]** = assumption or inference.

### 3.1 Audit of danialasghar.com (2026-11-26)

**Stack [V]**
- Astro 7 (`astro ^7.0.6`), fully static output.
- Dependencies: `@astrojs/mdx`, `@astrojs/rss`, `@astrojs/sitemap`, `rehype-autolink-headings`, `sharp`.
- Node `22.12.0` (`.node-version`, engines `>=22.12.0`).

**Hosting [V]**
- Cloudflare Workers, serving static files from `./dist` (`wrangler.toml`, `not_found_handling = "404-page"`).
- No server runtime, no database, no logins.
- Live responses are served by Cloudflare with `cf-cache-status: HIT`.

**Content [V]**
- 9 posts, all filed under live topic hubs:

| Hub | Posts |
|---|---|
| `background-jobs` | `how-solid-queue-works`, `idempotent-ai-workers-rails`, `sidekiq-job-runs-twice-at-least-once-delivery`, `sidekiq-retry-strategy-transient-vs-permanent-failures`, `solid-queue-vs-sidekiq`, `why-background-jobs-are-slow` |
| `database-reliability` | `postgres-race-conditions-row-locks-rails`, `rails-connection-pool-exhaustion`, `rails-deadlock-activerecord` |

**Topics [V]**
- Defined in `src/data/topics.ts`, with a `live` flag that gates each hub.
- `background-jobs` and `database-reliability` are live. `ai-backend` is defined but `live: false` until
  it has about 3 posts.

**Projects [V]**
- `ai-lead-engine`, `ai-support-ticket-triage-engine`, `covetpics`, `interstride`.

**Services [V]**

| Offer | Starting price | ID used in this plan |
|---|---|---|
| Background Job Reliability Audit | $1,000 | `jobs-audit` |
| Sidekiq / Solid Queue Scaling & Tuning | $2,000 | `scaling` |
| Postgres Concurrency & Lock Review | $3,000 | `postgres-review` |

Contact is by email only (`hello@danialasghar.com`). There is no scheduler.

**Existing tool [V]**
- `/tools/connection-pool-calculator/`, in `src/pages/tools/connection-pool-calculator.astro`.
- Built with numeric inputs, a `#verdict` region (`role="status"`, `aria-live="polite"`), a Copy button
  and a `<pre id="snippet">` config snippet.
- Has `SoftwareApplication` and FAQ JSON-LD.
- `/tools/index.astro` renders a hard-coded array.

**Navigation (redesign) [V]**
- Header: Writing, Projects, Tools, About, an outlined Services button, GitHub and theme toggle.
- Topic sub-bar on reading pages. Separate mobile menu.

**SEO [V]**
- TechArticle, FAQPage and BreadcrumbList JSON-LD.
- Sitemap with accurate `lastmod` for posts (`astro.config.mjs` `serialize`).
- Trailing-slash URLs, `robots.txt` allows everything, real 404 status.
- Self-hosted fonts.
- Titles are 60 characters or fewer (rule from `PRODUCT.md`).
- The live sitemap had 25 URLs on 2026-11-26. The `feat/premium-redesign` build has the same 25.

**Privacy and analytics [V]**
- Cloudflare Web Analytics, which is cookieless, enabled only when `PUBLIC_CF_BEACON_TOKEN` is set.
- MailerLite for the newsletter.
- `/privacy/` states that the site "sets no tracking cookies".
- There is no `/terms/` page and no `ads.txt` (both 404).

**Design system [V]**
- `DESIGN.md` and `PRODUCT.md`, both committed in `ed84151`.
- Ruby primary colour. Bricolage Grotesque, Charis SIL and JetBrains Mono.
- Green and clay are reserved for tool and diagram meanings.
- The Tool Verdict component is already specified.

**Unknown or unverified**
- Traffic and Search Console data.
- The ranking claims in `PRODUCT.md` (#1–6 for Sidekiq reliability terms).
- The Cloudflare plan tier.

### 3.2 What iLovePDF does (fetched 2026-11-26) [V unless marked]

**Homepage**
- 31 tool cards, each with a one-line benefit.
- Category filters that run in the browser without separate URLs (`data-filter`): Organize, Optimize,
  Convert, Edit, Security, Intelligence, Workflows.
- "New!" badges.
- Below the grid: apps, Business and Premium panels, and a cross-sell for its sister site.

**Navigation**
- The three most-used tools are linked directly. Then a "Convert" dropdown and an "All PDF tools" mega
  menu grouped by task.
- An "Other products" menu. A language picker with 26 languages.

**Tool pages**
- H1 is the tool name, H2 is a one-liner, then the upload area, options, progress and download.
- They are **deliberately bare**: no how-to text, no FAQ, no JSON-LD.
- After processing, the file can be sent straight to another tool without uploading again.
- URLs are flat, one level deep (`/merge_pdf`, `/compress_pdf`, `/edit-pdf`).

**SEO**
- Keyword-led titles ("Merge PDF files online. Free service to merge PDF").
- Translated slugs in each language (`/es/unir_pdf`).
- About 229 blog how-tos that link heavily into the tools. [A] The blog captures "how to" searches; the
  bare tool pages rank on brand and links.

**Monetization**
- Premium at $4–7 a month: no ads, higher limits, workflows.
- A Business tier, desktop and mobile apps, and a paid credit-based API (iLoveAPI).
- **Display ads come from Google Ad Manager (`gpt.js`), not AdSense**: one leaderboard per tool page.
- No ads seen on the homepage, the blog or iLoveIMG.

**Trust**
- Files deleted within 2 hours, plus a "Delete now" button.
- ISO 27001, processing in the EEA, a public status page, a security page.

**What we borrow:**
- one flat URL per tool
- task-based groups
- a menu that links the top tools directly
- a filterable grid that works in the browser
- one shared tool page structure
- "continue to" chaining between tools
- an explicit statement of what happens to your data
- blog how-tos linking into tools

**What we reject:**
- bare tool pages with no written content
- ads as the main revenue source
- server-side file processing
- consumer categories

### 3.3 AdSense policy findings (official Google sources)

| Topic | What the policy says | Source |
|---|---|---|
| Screens without content | No ads on screens "without publisher-content or with low-value content… used for alerts, navigation or other behavioral purposes". No ads on "dead end" screens (thank-you, exit, error pages) | https://support.google.com/publisherpolicies/answer/11112688 |
| Non-content pages | No ads "on any non-content-based page" or on pages "published specifically for the purpose of showing ads". No floating-box scripts, no pop-ups, no unexpected downloads. No AdSense code inside "software" (toolbars, apps) | https://support.google.com/adsense/answer/48182 |
| Copied content | No ads on copied or lightly rewritten content without added value | https://support.google.com/publisherpolicies/answer/11190248 |
| Accidental clicks | Take care placing ads near "download buttons, navigation buttons". No ads where they could be mistaken for navigation or download links. The publisher is responsible even when it's accidental. The only numeric guidance is 150px from games | https://support.google.com/adsense/answer/1346295 |
| User-generated content | The publisher must moderate it | https://support.google.com/adsense/answer/11035658 |
| Eligibility | 18 or older. Content "high-quality, original". Access to the HTML source | https://support.google.com/adsense/answer/9724 |
| Common rejections | Not enough original, rich content; under construction; hard to navigate | https://support.google.com/adsense/answer/81904 |
| Site review | Google reviews the whole site | https://support.google.com/adsense/answer/10162 |
| Ownership | `ads.txt` is one of three ways to verify | https://support.google.com/adsense/answer/12169212 |
| Privacy policy text | Must disclose that "Third party vendors, including Google, use cookies…" and explain how to opt out | https://support.google.com/adsense/answer/1348695 |
| EEA, UK and Switzerland | A certified consent tool using the TCF is required: EEA and UK since 16 Jan 2024, Switzerland since 31 Jul 2024 | https://support.google.com/adsense/answer/13554116 |
| EU consent policy | Users must give consent, records must be kept | https://www.google.com/about/company/user-consent-policy/ |
| Auto ads controls | Pages and page areas can be excluded. Overlay formats can be turned off. Vignettes can be blocked per link | https://support.google.com/adsense/answer/9261307 |
| Layout shift | Reserve space for each ad unit. Target CLS below 0.1 | https://developers.google.com/publisher-tag/guides/minimize-layout-shift |
| Page experience | Avoid "excessive amount of ads" and intrusive interstitials | https://developers.google.com/search/docs/appearance/page-experience |
| Chrome heavy ads | Ads exceeding 4 MB of network or 15 s CPU in any 30 s window, or 60 s total, are removed | https://developer.chrome.com/blog/heavy-ad-interventions |

**Inferences [A]**
- A bare upload-process-download screen is the textbook "no publisher content" case.
- Tools that run in the browser on our own pages count as web content, not "software".
- No source gives a reliable ad-revenue figure for developer audiences.

### 3.4 Domain options compared (decided: Option A + B combined)

| | A/B: same domain, `/tools/` + menu ✅ | C: subdomain | D: separate domain |
|---|---|---|---|
| SEO | Inherits the domain's authority | Partly treated as separate [A] | Starts from zero |
| AdSense | One site, approved on the strength of the articles | Covered once the root domain is approved [A] | Needs its own approval and risks "low-value content" |
| Brand | Strengthened, as long as tools pass §2.3 | Diluted, with no clean separation | Clean separation |
| Cost | $0 (already in place) | A second deploy | Domain, about $10–15 a year [A], plus a second site |
| Verdict | **Chosen** | Rejected | Reserved for any future consumer tools (S3) |

---

## 4. Goals and priority order

| Order | Goal | Why | Measured by |
|---|---|---|---|
| 1 (now) | **Consulting leads** | One $1k engagement is worth roughly a year of small-site ad revenue [A] | Tool page → `/services/` visits; emails that mention a tool (§13.6) |
| 2 (months 0–12) | **Organic traffic** | Drives both leads and future ad revenue | Search Console clicks and impressions, split into signature and utility searches; pages indexed |
| 3 (Phase 3 gate or later) | **AdSense** on low-intent pages | Earns from visitors who won't hire a consultant | Ad revenue per 1,000 utility pageviews; no drop in leads; Core Web Vitals |

**Revenue example [A]:** revenue = monthly pageviews ÷ 1000 × revenue per 1,000 views. At 10k pageviews and
$3–10 per 1,000, that's about $30–100 a month. Developers block ads at high rates. Ads are a supplement,
never the core.

---

## 5. Taxonomy: tiers, groups, URLs

### 5.1 Tiers

| Tier | Meaning | Visual weight | Call to action | Ads (future) |
|---|---|---|---|---|
| `signature` | Rails, Postgres, jobs and AI-backend tools rooted in the blog | Featured row, larger cards, homepage strip | Result-aware service CTA | **Never** |
| `utility` | Developer utilities that pass §2.3 | Compact grid | Newsletter, "Built by" line, related signature tool | Possible after the Phase 3 gate (`adsEligible`) |

### 5.2 Groups (category filters)

| Group ID | Label | Tier | Menu column |
|---|---|---|---|
| `jobs` | Jobs & Queues | signature | Jobs & Queues |
| `postgres` | Postgres & ActiveRecord | signature | Postgres |
| `rails` | Rails Runtime | signature | Rails & AI |
| `ai` | AI Backends | signature | Rails & AI |
| `data` | Data Formats | utility | Developer utilities |
| `encoding` | Encoding & Security | utility | Developer utilities |
| `time` | Time & IDs | utility | Developer utilities |
| `code` | Code & Text | utility | Developer utilities |
| `http` | HTTP & Web | utility | Developer utilities |
| `infra` | Infrastructure | utility | Developer utilities |

### 5.3 URL rules

- **Tool URL:** `/tools/<slug>/`. Flat, kebab-case, keyword-first, with a trailing slash. **The group is
  never part of the URL**, so tools can be regrouped without redirects.
- **Group page:** `/tools/<group>/`, generated **only once a group has 3 or more live tools**. This mirrors
  the `live` gate on topic hubs. Group IDs and tool slugs must never collide; a build-time check enforces
  this (§9.4).
- **Existing URL kept:** `/tools/connection-pool-calculator/` keeps its URL forever, including when it
  moves onto the shared layout.
- A slug is permanent once a tool is `live`. Renaming one needs an approved 301 redirect and an entry in
  §17.

---

## 6. Tool inventory, summary table (47 tools)

**Legend**
- **Browser:** ✅ runs fully in the browser with small code · ◐ in the browser with a large or lazy-loaded
  library
- **D / C / SEO:** search demand, competition, SEO potential (H, M, L)
- **Effort:** S = 1–3 days, M = 1–2 weeks, L = more than 2 weeks, including written content and tests
- **Money:** Leads = consulting · Ads = future AdSense candidate · Both
- All ratings are **estimates [A]**, to be checked in Phase 0 with Keyword Planner and Search Console.
  Update the table when real data arrives.

| # | Tool | Slug (proposed) | Tier | Group | Browser | D | C | Effort | SEO | Money | Wave | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Sidekiq retry schedule calculator | `sidekiq-retry-calculator` | signature | jobs | ✅ | M | L | S | H | Leads | **1** | planned |
| 2 | Queue capacity calculator (Little's law) | `job-queue-capacity-calculator` | signature | jobs | ✅ | M | L | S | H | Leads | **1** | planned |
| 3 | Backoff & jitter visualizer | `retry-backoff-jitter-visualizer` | signature | jobs | ✅ | M | M | S | M | Both | 2 | planned |
| 4 | Sidekiq memory & concurrency planner | `sidekiq-concurrency-memory-planner` | signature | jobs | ✅ | M | L | S | M | Leads | 2 | planned |
| 5 | Redis queue memory estimator | `redis-queue-memory-estimator` | signature | jobs | ✅ | L | L | S | M | Leads | 3 | planned |
| 6 | Job payload checker | `sidekiq-job-payload-checker` | signature | jobs | ✅ | L | L | S | M | Leads | 3 | planned |
| 7 | Unique-job lock TTL calculator | `unique-job-lock-ttl-calculator` | signature | jobs | ✅ | L | L | S | M | Leads | 4 | planned |
| 8 | Postgres deadlock log analyzer | `postgres-deadlock-analyzer` | signature | postgres | ✅ | M | L | M | H | Leads | **1** | planned |
| 9 | Postgres lock mode lookup | `postgres-lock-modes` | signature | postgres | ✅ | M | M | S | H | Leads | **1** | planned |
| 10 | Connection pool calculator v2 | `connection-pool-calculator` *(existing)* | signature | postgres | ✅ | M | L | S | H | Leads | 2 | live (v1) |
| 11 | Safe migration checker | `rails-safe-migration-checker` | signature | postgres | ✅ | M | M | M | H | Leads | 2 | planned |
| 12 | Postgres timeout builder | `postgres-timeout-config-builder` | signature | postgres | ✅ | M | L | S | M | Leads | 2 | planned |
| 13 | Blocking query finder | `postgres-blocking-query-finder` | signature | postgres | ✅ | M | M | S | M | Leads | 3 | planned |
| 14 | EXPLAIN ANALYZE viewer | `postgres-explain-analyze-viewer` | signature | postgres | ✅ | M | H | L | M | Both | 3 | planned |
| 15 | Isolation level explorer | `postgres-isolation-levels` | signature | postgres | ✅ | L | L | M | M | Leads | 4 | planned |
| 16 | Postgres memory calculator | `postgres-memory-calculator` | signature | postgres | ✅ | M | H | S | L | Ads | 4 | planned |
| 17 | Puma workers × threads calculator | `puma-workers-threads-calculator` | signature | rails | ✅ | M | L | S | H | Leads | 2 | planned |
| 18 | Rails log analyzer | `rails-log-analyzer` | signature | rails | ✅ | M | L | M | H | Leads | 3 | planned |
| 19 | `database.yml` validator | `rails-database-yml-validator` | signature | rails | ✅ | L | L | S | M | Leads | 3 | planned |
| 20 | Rails credentials decryptor | `rails-credentials-decryptor` | signature | rails | ✅ | M | L | M | M | Both | 4 | planned |
| 21 | LLM cost estimator | `llm-api-cost-calculator` | signature | ai | ✅ | H | H | S | M | Both | 3 | planned |
| 22 | LLM rate limit vs worker concurrency planner | `llm-rate-limit-concurrency-planner` | signature | ai | ✅ | M | L | S | H | Leads | 3 | planned |
| 23 | Context window fit checker | `llm-context-window-checker` | signature | ai | ◐ | M | M | M | M | Ads | 4 | planned |
| 24 | JSON formatter & validator (+ Ruby hash) | `json-formatter` | utility | data | ✅ | H | H | S | M | Ads | 2 | planned |
| 25 | JSON ↔ YAML converter | `json-yaml-converter` | utility | data | ◐ | H | H | S | M | Ads | 3 | planned |
| 26 | JSON → Ruby Struct / `Data.define` | `json-to-ruby-class` | utility | data | ✅ | L | L | S | H | Both | 3 | planned |
| 27 | CSV ↔ JSON converter | `csv-json-converter` | utility | data | ✅ | H | H | S | L | Ads | 4 | planned |
| 28 | JWT decoder + HS256 verify | `jwt-decoder` | utility | encoding | ✅ | H | H | S | M | Ads | 2 | planned |
| 29 | Webhook signature verifier | `webhook-signature-verifier` | utility | encoding | ✅ | M | L | S | H | Both | 3 | planned |
| 30 | Hash / HMAC generator | `hash-hmac-generator` | utility | encoding | ✅ | H | H | S | L | Ads | 4 | planned |
| 31 | Base64 / URL encode-decode | `base64-url-encoder` | utility | encoding | ✅ | H | H | S | L | Ads | 4 | planned |
| 32 | CSP header builder | `csp-header-builder` | utility | encoding | ✅ | M | M | M | M | Both | 4 | planned |
| 33 | Cron explainer + `recurring.yml` | `cron-expression-explainer` | utility | time | ✅ | H | H | S | H | Both | **1** | planned |
| 34 | Unix timestamp converter | `unix-timestamp-converter` | utility | time | ✅ | H | H | S | M | Ads | 2 | planned |
| 35 | UUID v4/v7 & ULID generator | `uuid-ulid-generator` | utility | time | ✅ | H | H | S | M | Ads | 2 | planned |
| 36 | ISO 8601 duration ↔ ActiveSupport::Duration | `iso8601-duration-converter` | utility | time | ✅ | L | L | S | M | Ads | 4 | planned |
| 37 | Regex tester (Ruby differences flagged) | `ruby-regex-tester` | utility | code | ✅ | H | H | M | M | Ads | 3 | planned |
| 38 | SQL formatter (Postgres) | `sql-formatter` | utility | code | ◐ | H | H | S | M | Ads | 3 | planned |
| 39 | Text / JSON diff | `text-json-diff` | utility | code | ✅ | H | H | S | L | Ads | 4 | planned |
| 40 | Case converter (Rails inflections) | `case-converter` | utility | code | ✅ | M | H | S | L | Ads | 4 | planned |
| 41 | cURL → Ruby converter | `curl-to-ruby` | utility | http | ✅ | M | M | M | H | Both | 3 | planned |
| 42 | HTTP status codes (with Rails symbols) | `http-status-codes` | utility | http | ✅ | H | H | S | M | Ads | 3 | planned |
| 43 | Cache-Control builder & explainer | `cache-control-header-builder` | utility | http | ✅ | M | M | S | M | Both | 4 | planned |
| 44 | Meta tag / Open Graph preview | `meta-tag-og-preview` | utility | http | ✅ | M | H | S | L | Ads | 4 | planned |
| 45 | robots.txt tester | `robots-txt-tester` | utility | http | ✅ | M | M | S | L | Ads | 4 | planned |
| 46 | CIDR / subnet calculator | `cidr-subnet-calculator` | utility | infra | ✅ | H | H | S | L | Ads | 4 | planned |
| 47 | chmod calculator | `chmod-calculator` | utility | infra | ✅ | M | H | S | L | Ads | 4 | planned |

**Totals:** 23 signature tools and 24 utilities. All 47 run in the browser. Wave 1 has 5 tools, Wave 2 has
10, Wave 3 has 15 and Wave 4 has 17. Wave 4 tools rated SEO = L are **optional** and are dropped if the
Phase 3 review shows utilities aren't earning their place.

**Deliberately excluded:**
- Anything that fetches a URL on the server (website checkers, uptime monitors): server-side request
  forgery risk and server cost.
- Consumer tools (PDF, image, general text).
- Anything that needs a paid AI API at runtime.

---

## 7. Tool specifications (all 47)

Each entry covers purpose, functionality, inputs, outputs, links and notes. Ratings are in §6. The first
five tools (#1, #2, #8, #9, #33) have full specifications in §8; their entries here are summaries.

Every tool shares these behaviours: share link (§12.6), copy-to-clipboard on every output block, validation
messages next to the field, and an empty state that explains what to paste.

### 7.1 Jobs & Queues (signature)

#### #1 Sidekiq retry schedule calculator — `sidekiq-retry-calculator` · Wave 1
- **Purpose:** answers "when does retry N fire, and when does this job die?"
- **Functionality:** reproduces Sidekiq's default retry delay formula, Active Job's `retry_on` waits, or a
  custom constant wait. Shows each retry's time, the running total and when the job reaches the dead set.
- **Inputs:** retry engine; `retry` count (default 25); optional first-failure time; timezone.
- **Outputs:** a table of retries with min, expected and max delay; total time to the dead set; a timeline
  chart; a Ruby config snippet.
- **Links:** `sidekiq-retry-strategy-transient-vs-permanent-failures`,
  `sidekiq-job-runs-twice-at-least-once-delivery`. Service `jobs-audit`.
- **Full spec:** §8.1.

#### #2 Queue capacity calculator — `job-queue-capacity-calculator` · Wave 1
- **Purpose:** how many workers keep latency within target? Is the queue stable?
- **Functionality:** Little's law plus an M/M/c (Erlang C) queueing model. Calculates utilization, chance a
  job waits, average and p95 queue wait, backlog growth and drain time, and the concurrency needed to hit
  a latency target.
- **Inputs:** arrival rate and unit; average job duration; processes × threads; optional latency target;
  peak multiplier; optional current backlog.
- **Outputs:** verdict strip; metrics; required concurrency; database connections implied, with a link that
  pre-fills the pool calculator.
- **Links:** `why-background-jobs-are-slow`, `solid-queue-vs-sidekiq`. Service `scaling`.
- **Full spec:** §8.2.

#### #3 Backoff & jitter visualizer — `retry-backoff-jitter-visualizer` · Wave 2
- **Purpose:** compare backoff strategies and see why jitter prevents retry storms.
- **Functionality:**
  - Strategies: constant, linear, exponential, and the full, equal and decorrelated jitter variants from
    the AWS Architecture Blog.
  - Simulates N clients failing at the same moment and plots how their retries spread out.
  - Uses a seeded random generator so results can be reproduced and tested.
- **Inputs:** base delay, cap, multiplier, attempts, strategy, number of clients, random seed.
- **Outputs:** per-attempt delay chart; histogram of retry arrivals; peak concurrent retries; Ruby snippet
  (Sidekiq `sidekiq_retry_in` / Active Job `wait:` lambda).
- **Links:** the retry strategy post. Service `jobs-audit`.
- **Notes:** results of the random strategies are checked against their theoretical bounds.

#### #4 Sidekiq memory & concurrency planner — `sidekiq-concurrency-memory-planner` · Wave 2
- **Purpose:** size Sidekiq processes and containers by memory and CPU.
- **Functionality:**
  - From baseline memory per process and memory growth per thread, calculates total memory per process.
  - Calculates processes per container under a memory limit, CPU saturation, and total database
    connections.
  - Warns about memory bloat from glibc arenas (`MALLOC_ARENA_MAX`) and jemalloc.
- **Inputs:** container memory and CPUs; baseline process memory; memory per thread; concurrency; headroom
  %; number of containers.
- **Outputs:** recommended concurrency and process count; memory headroom; connection count, chained to #10.
- **Links:** `why-background-jobs-are-slow`, `rails-connection-pool-exhaustion`. Service `scaling`.

#### #5 Redis queue memory estimator — `redis-queue-memory-estimator` · Wave 3
- **Purpose:** how much Redis memory does a backlog, retry set or dead set use?
- **Functionality:** payload bytes × job count, plus Redis per-entry overhead (an estimate, shown as a
  range). Covers retry, scheduled and dead sets, and checks the result against `maxmemory` with an
  eviction-policy warning (`noeviction` is required for Sidekiq).
- **Inputs:** average payload size, or a pasted sample payload; queue depth; retry, scheduled and dead set
  sizes; `maxmemory`.
- **Outputs:** an estimated memory range; % of `maxmemory`; warnings.
- **Notes:** overhead figures are approximations. State them as such and cite their source.

#### #6 Job payload checker — `sidekiq-job-payload-checker` · Wave 3
- **Purpose:** catch job arguments that are dangerous or too large before they reach production.
- **Functionality:**
  - Parses pasted JSON args or a Ruby-like `perform_async(...)` call.
  - Measures the serialized size.
  - Flags: non-JSON-native types (symbols, Time, objects); large blobs; whole records instead of IDs;
    Active Job's GlobalID; personal data patterns (email, card-like numbers).
- **Inputs:** an args JSON array or the call text; size threshold.
- **Outputs:** size; a list of findings by severity; a suggested refactor (pass IDs).
- **Links:** `idempotent-ai-workers-rails`, `sidekiq-job-runs-twice-at-least-once-delivery`.

#### #7 Unique-job lock TTL calculator — `unique-job-lock-ttl-calculator` · Wave 4
- **Purpose:** pick a uniqueness lock TTL that neither expires mid-job nor blocks legitimate re-runs.
- **Functionality:** models job runtime (p50, p99), the retry schedule (reuses #1's logic) and the lock
  strategy (`until_executed`, `until_executing`, `while_executing`). Warns where the lock can expire while
  the job is still running, or outlive it.
- **Inputs:** runtime percentiles; lock strategy; TTL; retry settings.
- **Outputs:** a timeline showing the windows where duplicates are possible; a recommended TTL.
- **Notes:** names the gems it models (sidekiq-unique-jobs, Sidekiq Enterprise unique jobs) and their
  versions.

### 7.2 Postgres & ActiveRecord (signature)

#### #8 Postgres deadlock log analyzer — `postgres-deadlock-analyzer` · Wave 1
- **Purpose:** turn a `deadlock detected` error into a diagnosis and a fix.
- **Functionality:** parses Postgres server logs, `ActiveRecord::Deadlocked` / `PG::TRDeadlockDetected`
  messages and Rails log snippets. Builds the wait-for cycle, works out the tables and statements involved,
  classifies the pattern, and recommends fixes.
- **Inputs:** pasted text (any of those formats); optional table-name hints.
- **Outputs:** a cycle diagram; a table of processes; plain-English lock explanation; pattern diagnosis;
  Rails fix snippets.
- **Links:** `rails-deadlock-activerecord`, `postgres-race-conditions-row-locks-rails`. Service
  `postgres-review`.
- **Full spec:** §8.3.

#### #9 Postgres lock mode lookup — `postgres-lock-modes` · Wave 1
- **Purpose:** for an operation, show which lock it takes and what it blocks or waits for.
- **Functionality:**
  - A searchable list of SQL statements and Rails migration methods → table-level lock mode.
  - The 8×8 conflict matrix.
  - "Will A block B?" comparison and row-level lock modes.
- **Inputs:** a search query, or two operations to compare.
- **Outputs:** lock mode, its conflicts, a plain-English impact, safer alternatives, and a link to the
  Postgres docs section.
- **Links:** both database reliability posts, the `database-reliability` hub. Service `postgres-review`.
- **Full spec:** §8.4.

#### #10 Connection pool calculator v2 — `connection-pool-calculator` (existing URL) · Wave 2
- **Purpose:** size the ActiveRecord pool against Puma, Sidekiq and Postgres `max_connections`, now
  including PgBouncer.
- **Functionality (v2):**
  - Everything v1 does.
  - PgBouncer pool modes (session vs transaction, and the caveat about prepared statements and advisory
    locks).
  - `default_pool_size` and `max_client_conn`.
  - Connection budget per host and per database role.
  - Pre-fill from #2, #4 and #17 via the share link.
- **Inputs:** v1 inputs + PgBouncer mode and sizes + number of hosts.
- **Outputs:** v1 verdict + per-layer budget table + `database.yml` and `pgbouncer.ini` snippets.
- **Notes:** migrate onto the shared layout at **the same URL**. Existing JSON-LD and FAQ content kept;
  any title or meta changes need owner approval (§1 rule 12).

#### #11 Safe migration checker — `rails-safe-migration-checker` · Wave 2
- **Purpose:** flag Rails migration operations that take blocking locks or rewrite tables.
- **Functionality:**
  - Parses the Ruby text of migration bodies with a tokenizer and patterns (not a full Ruby parser).
  - Maps each call to a lock mode using #9's data.
  - Flags risks, in the spirit of the `strong_migrations` gem's checks: `add_index` without
    `algorithm: :concurrently`; `add_column` with a volatile default; `change_column`;
    `add_foreign_key` without `validate: false`; adding `NOT NULL`; `remove_column` without
    `ignored_columns`.
- **Inputs:** pasted migration code; Postgres version; table size hint.
- **Outputs:** per-line findings (lock, risk, safe rewrite); a rewritten safe migration.
- **Links:** the database reliability hub. Service `postgres-review`.
- **Notes:** credit `strong_migrations` as prior art. Never copy its code or text. Behaviour that depends
  on the Postgres version (e.g. a constant default on `add_column` stopped rewriting the table in PG 11) is
  modelled by version.

#### #12 Postgres timeout builder — `postgres-timeout-config-builder` · Wave 2
- **Purpose:** choose `statement_timeout`, `lock_timeout` and `idle_in_transaction_session_timeout`, and
  generate the config.
- **Functionality:** asks about the workload type (web request, background job, migration) and suggests
  values with reasons. Outputs `database.yml` `variables:`, `SET` statements and per-role `ALTER ROLE`.
- **Inputs:** workload profile; p99 query time; request timeout; migration safety preference.
- **Outputs:** config snippets; explanation; warnings (e.g. `lock_timeout` higher than `statement_timeout`).
- **Links:** `rails-connection-pool-exhaustion`, `rails-deadlock-activerecord`.

#### #13 Blocking query finder — `postgres-blocking-query-finder` · Wave 3
- **Purpose:** generate the right diagnostic SQL and explain what it returns.
- **Functionality:**
  - Builds queries over `pg_stat_activity` / `pg_locks` / `pg_blocking_pids()`, filtered by what the user
    is looking for.
  - Accepts the pasted output (psql table or CSV) and explains who blocks whom, as a tree.
- **Inputs:** goal (blocked queries, long transactions, idle in transaction); pasted output.
- **Outputs:** SQL; a blocking tree; next steps (`pg_cancel_backend` vs `pg_terminate_backend`, with
  warnings).

#### #14 EXPLAIN ANALYZE viewer — `postgres-explain-analyze-viewer` · Wave 3
- **Purpose:** make query plans readable for Rails developers.
- **Functionality:**
  - Parses `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` and the text format.
  - Shows a node tree with exclusive time and row-estimate errors.
  - Flags: Seq Scan on large tables, nested loops with big row counts, sorts spilling to disk, poor
    estimates.
  - Hints for ActiveRecord: `includes` vs `joins`, missing index candidates.
- **Inputs:** pasted plan.
- **Outputs:** an interactive tree; ranked findings.
- **Notes:** competition is high (explain.dalibo.com, explain.depesz.com). Stand out through the
  ActiveRecord hints. Effort L.

#### #15 Isolation level explorer — `postgres-isolation-levels` · Wave 4
- **Purpose:** teach which anomalies each isolation level allows, with Rails examples.
- **Functionality:**
  - An interactive scenario stepper: two transactions, step by step, at Read Committed, Repeatable Read
    and Serializable.
  - Shows lost updates, write skew and serialization failures, and the Rails code that causes and fixes
    each.
- **Inputs:** choice of scenario and isolation level.
- **Outputs:** a step-by-step timeline; outcome; the Rails fix (`lock`, `with_lock`, retry on
  `ActiveRecord::SerializationFailure`).
- **Notes:** the behaviour is precomputed from Postgres docs semantics, not simulated by a database engine.
  Every scenario cites its source.

#### #16 Postgres memory calculator — `postgres-memory-calculator` · Wave 4
- **Purpose:** suggested `shared_buffers`, `work_mem`, `effective_cache_size` and `maintenance_work_mem`.
- **Functionality:** commonly used heuristics, plus the worst-case `work_mem` × connections × sort nodes
  warning that links to pool sizing.
- **Inputs:** RAM, CPUs, connections, workload type, storage type.
- **Outputs:** a `postgresql.conf` snippet; a warning table.
- **Notes:** pgtune covers this already, so it differs only by the Rails pool angle. It is optional.

### 7.3 Rails Runtime (signature)

#### #17 Puma workers × threads calculator — `puma-workers-threads-calculator` · Wave 2
- **Purpose:** size Puma `workers` and `threads` from CPU, memory and I/O mix.
- **Functionality:** workers from CPU count; threads from the share of request time spent on I/O; memory
  check per worker; connection count chained to #10. Notes the Rails 7.2+ default of 3 threads.
- **Inputs:** CPUs; memory; memory per worker; % I/O wait; target concurrency.
- **Outputs:** `config/puma.rb` snippet; `RAILS_MAX_THREADS` / `WEB_CONCURRENCY`; pool implications.
- **Links:** `rails-connection-pool-exhaustion`. Service `scaling`.

#### #18 Rails log analyzer — `rails-log-analyzer` · Wave 3
- **Purpose:** find slow endpoints, and whether time goes to the database or the views, from a pasted
  `production.log`.
- **Functionality:**
  - Parses `Started … Processing by … Completed 200 OK in Xms (Views: Yms | ActiveRecord: Zms |
    Allocations: N)`.
  - Groups by controller#action and calculates p50, p95 and max.
  - Spots likely N+1 queries from repeated SQL lines.
  - Runs in a Web Worker, so pastes of several MB don't freeze the page.
- **Inputs:** pasted log, or a dropped `.log` file read locally (FileReader; never uploaded).
- **Outputs:** a sortable endpoint table; time breakdown chart; N+1 suspects.
- **Links:** `why-background-jobs-are-slow`. Service `scaling`.
- **Notes:** also handle Lograge JSON lines.

#### #19 `database.yml` validator — `rails-database-yml-validator` · Wave 3
- **Purpose:** catch common mistakes in `database.yml`.
- **Functionality:**
  - Parses YAML with anchors and aliases.
  - Simplifies common ERB patterns (`<%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>`) into "value from ENV,
    default 5".
  - Flags: `pool` lower than threads; missing `prepared_statements: false` with PgBouncer transaction
    mode; timeouts missing; multi-db `replica:` mistakes.
- **Inputs:** pasted YAML; optional ENV values.
- **Outputs:** the resolved config per environment; findings.
- **Notes:** needs a YAML library (lazy-loaded). Shares the parser with #25.

#### #20 Rails credentials decryptor — `rails-credentials-decryptor` · Wave 4
- **Purpose:** decrypt or inspect `credentials.yml.enc` locally, e.g. to recover a value or compare
  environments.
- **Functionality:** reproduces ActiveSupport::EncryptedFile (AES-128-GCM by default in modern Rails;
  verify per version) using WebCrypto.
- **Inputs:** the `.enc` contents; the master key.
- **Outputs:** the decrypted YAML (masked by default, revealed on request).
- **Notes:** **highest trust bar of any tool.**
  - Strict CSP with no network access at all.
  - Never stored in the share link (share links are disabled for this tool).
  - Prominent explanation, and a recommendation to use `bin/rails credentials:show` when possible.
  - Ships only with owner approval of the trust copy.

### 7.4 AI Backends (signature, launches with the `ai-backend` hub)

#### #21 LLM cost estimator — `llm-api-cost-calculator` · Wave 3
- **Purpose:** estimate monthly API cost for a background AI workload.
- **Functionality:** jobs per day × input/output tokens × model price, with prompt caching and batch
  discounts where a provider offers them; compares providers.
- **Inputs:** job volume; tokens per job; model(s); cache hit %; batch share.
- **Outputs:** cost per job, day and month; comparison table.
- **Notes:**
  - Prices live in a data file with a `lastVerified` date per model, shown on the page.
  - Needs a **monthly maintenance task** (§16 Phase 3 risks).
  - Does not depend on any provider being reachable at runtime.

#### #22 LLM rate limit vs worker concurrency planner — `llm-rate-limit-concurrency-planner` · Wave 3
- **Purpose:** set Sidekiq or Solid Queue concurrency so AI jobs don't hit provider rate limits
  (requests per minute, tokens per minute).
- **Functionality:**
  - From request latency and tokens per request, calculates the maximum safe concurrency.
  - Shows 429 risk, and the throttle settings needed (sidekiq-limit_fetch / Enterprise limiters / Solid
    Queue concurrency controls).
- **Inputs:** RPM and TPM limits; average latency; tokens per request; target throughput.
- **Outputs:** max concurrency; expected throughput; throttle snippet.
- **Links:** `idempotent-ai-workers-rails`. Service `jobs-audit`.

#### #23 Context window fit checker — `llm-context-window-checker` · Wave 4
- **Purpose:** will this prompt plus its retrieved documents fit the model's context window, and what will
  it cost?
- **Functionality:** approximate token counts (a lazy-loaded tokenizer where one is public; otherwise a
  calibrated characters-per-token estimate, clearly labelled as approximate).
- **Inputs:** pasted text; model.
- **Outputs:** token estimate as a range; % of the context window; cost.
- **Notes:** never claim exact counts for models without public tokenizers.

### 7.5 Data Formats (utility)

#### #24 JSON formatter & validator — `json-formatter` · Wave 2
- **Purpose:** format, minify and validate JSON, and point to errors precisely.
- **Functionality:**
  - Parse errors with line and column, and the surrounding text.
  - Format with 2 or 4 spaces or tabs; minify; sort keys.
  - **"Copy as Ruby hash"** (symbol or string keys).
  - Collapsible tree view.
  - Large inputs (more than 1 MB) are parsed in a Web Worker.
- **Inputs:** pasted JSON or a local file.
- **Outputs:** formatted text; tree; Ruby hash; error details.
- **Rails angle:** `JSON.parse(..., symbolize_names: true)` and `as_json` pitfalls in the written content.

#### #25 JSON ↔ YAML converter — `json-yaml-converter` · Wave 3
- **Purpose:** convert between JSON and YAML, including Rails config YAML.
- **Functionality:** handles anchors, aliases and merge keys (`<<:`); errors with line numbers; warns about
  YAML 1.1 vs 1.2 quirks such as the "Norway problem" (`no` read as `false`) that Psych users hit.
- **Inputs:** text in either format.
- **Outputs:** the other format; warnings.
- **Notes:** needs a YAML library (lazy-loaded, about 30–50 KB [A]).

#### #26 JSON → Ruby Struct / `Data.define` — `json-to-ruby-class` · Wave 3
- **Purpose:** turn API response JSON into Ruby value objects.
- **Functionality:**
  - Infers types from the sample.
  - Generates `Data.define` (Ruby 3.2+), `Struct` with `keyword_init`, or a plain class.
  - Nested objects become nested classes, plus a `from_h` builder.
  - Optional `dry-struct` output.
- **Inputs:** JSON sample; root class name; output style.
- **Outputs:** Ruby code.

#### #27 CSV ↔ JSON converter — `csv-json-converter` · Wave 4
- **Purpose:** convert CSV to JSON and back, correctly.
- **Functionality:** RFC 4180 quoting, choice of delimiter, header row, type inference (optional), handling
  of large files in a worker.
- **Inputs:** text or a local file.
- **Outputs:** the converted text and a download.
- **Notes:** optional, Wave 4.

### 7.6 Encoding & Security (utility)

#### #28 JWT decoder + HS256 verify — `jwt-decoder` · Wave 2
- **Purpose:** decode a JWT's header and payload and check claims; optionally verify an HMAC signature.
- **Functionality:**
  - Base64url decoding.
  - Human-readable dates for `exp`, `iat` and `nbf`, plus an "expired?" check.
  - Optional HS256/384/512 verification via WebCrypto with a pasted secret.
  - RS256 verification with a pasted public key (Wave 4 upgrade).
  - A warning when `alg: none` is used.
- **Inputs:** token; optional secret or key.
- **Outputs:** decoded JSON; claim table; verification result.
- **Rails angle:** the `jwt` gem and Devise-JWT examples. Never send a token anywhere (§11).

#### #29 Webhook signature verifier — `webhook-signature-verifier` · Wave 3
- **Purpose:** debug "signature mismatch" for Stripe, GitHub, Shopify and Slack webhooks.
- **Functionality:**
  - Provider presets reproduce each provider's signing scheme (e.g. Stripe `t=…,v1=…` over
    `timestamp.payload`; GitHub `X-Hub-Signature-256` HMAC-SHA256).
  - Highlights the usual cause: the body was re-serialized instead of using the raw body.
- **Inputs:** provider; raw body; header value; secret.
- **Outputs:** expected vs received signature; diagnosis; Rails controller snippet using `request.raw_post`.
- **Notes:** each scheme is cited to the provider's docs and covered by tests using their published
  examples.

#### #30 Hash / HMAC generator — `hash-hmac-generator` · Wave 4
- **Purpose:** SHA-1/256/384/512 hashes and HMACs, plus MD5 for legacy checksums.
- **Functionality:** WebCrypto for SHA; a small MD5 implementation (WebCrypto has none); text or file
  input; hex or base64 output.
- **Outputs:** digest; Ruby `Digest` / `OpenSSL::HMAC` equivalents.
- **Notes:** optional, Wave 4.

#### #31 Base64 / URL encode-decode — `base64-url-encoder` · Wave 4
- **Purpose:** encode and decode Base64, Base64url and percent-encoding.
- **Functionality:** UTF-8-safe; strict and lenient modes; shows the difference between
  `Base64.strict_encode64` and `encode64` (Ruby adds newlines).
- **Notes:** optional, Wave 4.

#### #32 CSP header builder — `csp-header-builder` · Wave 4
- **Purpose:** build and explain a Content-Security-Policy.
- **Functionality:** a form for each directive; presets; parses and explains a pasted existing header;
  outputs Rails `content_security_policy` initializer code and the raw header; warnings (`unsafe-inline`,
  wildcards).
- **Rails angle:** nonces with `content_security_policy_nonce_generator`.

### 7.7 Time & IDs (utility)

#### #33 Cron expression explainer + `recurring.yml` — `cron-expression-explainer` · Wave 1
- **Purpose:** explain a cron expression, list its next runs, and generate Solid Queue and sidekiq-cron
  config.
- **Functionality:** full 5-field cron grammar (6-field with seconds for sidekiq-cron); macros; plain
  English; next N runs in a chosen timezone, correct across daylight-saving changes; config generators.
- **Inputs:** expression, or a builder form; timezone; job class; queue; args.
- **Outputs:** description; next-run list; `config/recurring.yml` entry; sidekiq-cron YAML.
- **Links:** `how-solid-queue-works`, `solid-queue-vs-sidekiq`.
- **Full spec:** §8.5.

#### #34 Unix timestamp converter — `unix-timestamp-converter` · Wave 2
- **Purpose:** convert between epoch seconds, milliseconds, microseconds and nanoseconds, ISO 8601 and
  local time.
- **Functionality:** detects the unit from the number of digits; converts any timezone; live current time;
  relative time.
- **Outputs:** all formats; Ruby snippets (`Time.at(x).utc`, `Time.zone.at`, `.to_i`, `.iso8601`).

#### #35 UUID v4/v7 & ULID generator — `uuid-ulid-generator` · Wave 2
- **Purpose:** generate and inspect UUIDs and ULIDs.
- **Functionality:**
  - Generation with `crypto.getRandomValues` / `crypto.randomUUID`: v4, v7 (time-ordered, RFC 9562) and
    ULID.
  - Bulk generation.
  - Decode: version, variant, embedded timestamp.
- **Content angle:** Postgres primary keys (B-tree locality of v7 vs v4; Rails `id: :uuid`).
- **Notes:** v7 layout tested against RFC 9562's test vectors.

#### #36 ISO 8601 duration ↔ ActiveSupport::Duration — `iso8601-duration-converter` · Wave 4
- **Purpose:** convert `P1DT2H` to and from `1.day + 2.hours` and seconds.
- **Functionality:** parse and build; calendar-aware notes (months and years are not fixed lengths).
- **Outputs:** Ruby code and total seconds, with caveats.

### 7.8 Code & Text (utility)

#### #37 Regex tester — `ruby-regex-tester` · Wave 3
- **Purpose:** test regexes with matches highlighted and Ruby-specific differences flagged.
- **Functionality:**
  - Runs on the JavaScript regex engine.
  - A **static analysis pass flags syntax where Ruby (Onigmo) behaves differently**: `^`/`$` are line
    anchors in Ruby; `\A` / `\z`; `(?<name>)`; possessive quantifiers; `\h`; the `x` and `m` flag
    differences.
  - Shows match groups, substitution preview and a Ruby code snippet.
- **Inputs:** pattern; flags; test text.
- **Outputs:** highlighted matches; groups table; Ruby difference warnings.
- **Notes:** running Ruby itself in the browser (ruby.wasm, several MB) would be exact but heavy. Evaluate
  it in Wave 3; the default is JS plus flagged differences, stated honestly on the page.

#### #38 SQL formatter (Postgres) — `sql-formatter` · Wave 3
- **Purpose:** format SQL, including what ActiveRecord logs.
- **Functionality:**
  - Postgres dialect formatting via a lazy-loaded library (e.g. `sql-formatter` npm, MIT licence [A]).
  - Strips the Rails log prefix (`  User Load (0.4ms)  SELECT …`).
  - Inlines binds (`$1` with `[["id", 5]]`).
- **Outputs:** formatted SQL; copy.

#### #39 Text / JSON diff — `text-json-diff` · Wave 4
- **Purpose:** compare two texts, or two JSON documents structurally.
- **Functionality:** line and word diff (Myers algorithm); JSON mode compares key by key, ignoring key
  order.
- **Notes:** optional, Wave 4.

#### #40 Case converter — `case-converter` · Wave 4
- **Purpose:** convert between snake_case, camelCase, PascalCase, kebab-case, SCREAMING_CASE, Title Case,
  and Rails `tableize`/`classify`/`singularize`.
- **Notes:** reimplements Rails inflection rules for English defaults; edge cases are documented. Optional,
  Wave 4.

### 7.9 HTTP & Web (utility)

#### #41 cURL → Ruby converter — `curl-to-ruby` · Wave 3
- **Purpose:** turn a `curl` command (often copied from browser devtools or API docs) into Ruby code.
- **Functionality:**
  - Shell-style argument parsing.
  - Supports `-X`, `-H`, `-d/--data*`, `-F`, `-u`, `--json`, `-G`, `-k`, and URL query strings.
  - Output styles: Net::HTTP, Faraday and HTTParty.
- **Outputs:** Ruby code; a list of unsupported flags.

#### #42 HTTP status codes reference — `http-status-codes` · Wave 3
- **Purpose:** every status code, with its meaning, its Rails symbol (`:unprocessable_entity` →
  `:unprocessable_content` in Rack 3.1+), and when to use it.
- **Functionality:** search, filtering by class, and a detail view showing what a Rails `head` / `render
  status:` call returns.
- **Notes:** a static data page. The written content must be original to avoid the replicated-content
  rule.

#### #43 Cache-Control builder & explainer — `cache-control-header-builder` · Wave 4
- **Purpose:** build and explain `Cache-Control` headers, including what CDNs do with them.
- **Functionality:** directive form; parses and explains pasted headers; Rails `expires_in`, `fresh_when`
  and `http_cache_forever` equivalents.

#### #44 Meta tag / Open Graph preview — `meta-tag-og-preview` · Wave 4
- **Purpose:** preview how a pasted `<head>` appears in search results and social cards.
- **Functionality:** parses pasted HTML only (**no URL fetching**, to avoid server-side request forgery);
  title and description length checks; OG and Twitter card previews.
- **Notes:** optional, Wave 4.

#### #45 robots.txt tester — `robots-txt-tester` · Wave 4
- **Purpose:** check whether a path is allowed for a user-agent.
- **Functionality:** implements RFC 9309 matching (longest match, `*` and `$`) on pasted rules.
- **Notes:** optional, Wave 4. Tested against RFC 9309's examples.

### 7.10 Infrastructure (utility)

#### #46 CIDR / subnet calculator — `cidr-subnet-calculator` · Wave 4
- **Purpose:** IPv4 and IPv6 CIDR maths: network, broadcast, range, host count, contains-IP check.
- **Content angle:** Postgres `pg_hba.conf` and the `inet`/`cidr` types.
- **Notes:** optional, Wave 4.

#### #47 chmod calculator — `chmod-calculator` · Wave 4
- **Purpose:** convert between symbolic and octal permissions, including setuid, setgid and sticky bits.
- **Notes:** optional, Wave 4.

---

## 8. First five tools: implementation specifications

All five use the shared architecture (§9) and must meet the Definition of Done (§10.8).

**Order of build:**

| Order | Tool | Why this position |
|---|---|---|
| 1 | #9 lock modes | Mostly data. Proves the layout with the least logic risk. Its data is reused by #8 and #11 |
| 2 | #1 retry calculator | |
| 3 | #2 queue capacity | |
| 4 | #33 cron | |
| 5 | #8 deadlock analyzer | The most complex, so it benefits from a stable layout and from #9's data |

**Estimated effort [A]:** 4–6 weeks part-time for the foundation plus all five, including written content.

### 8.1 Sidekiq retry schedule calculator (`sidekiq-retry-calculator`)

**Engines modelled.** Each must be checked against the source code of the pinned versions before coding.
Record the file and line reference in `logic.ts`:

| Engine | Delay formula (to be verified) | Source to check |
|---|---|---|
| Sidekiq default (6.x, 7.x, 8.x) | `delay = count**4 + 15`, `jitter = rand(10) * (count + 1)`; `count` starts at 0 for the first retry | `lib/sidekiq/job_retry.rb` (`delay_for`) |
| Sidekiq custom | `sidekiq_retry_in { \|count, exc, job\| … }` returning seconds. The tool takes either a constant or a polynomial (a·count^p + b) | same |
| Active Job `retry_on` | `wait:` an integer number of seconds, or `:polynomially_longer` (Rails 7.1+; formerly `:exponentially_longer`), with `attempts:` (default 5) and `jitter:` (default 0.15) | `activejob/lib/active_job/exceptions.rb` (`determine_delay`) for 7.1, 7.2, 8.0, 8.1 |

**Inputs and validation**

| Field | Type | Range | Default | Error message |
|---|---|---|---|---|
| Engine | select | sidekiq / activejob / custom | sidekiq | — |
| Sidekiq version | select | 6.x / 7.x / 8.x | 7.x | — |
| `retry` count | integer | 0–100 (warn above 25) | 25 | "Enter a whole number from 0 to 100." |
| Active Job `attempts` | integer | 1–100 | 5 | same pattern |
| Active Job wait | select + number | seconds 0–86,400 or `:polynomially_longer` | 3 s | "Wait must be 0–86,400 seconds." |
| Custom: a, p, b | numbers | a ≥ 0, 0 ≤ p ≤ 6, b ≥ 0 | 1, 4, 15 | per field |
| Start time | datetime-local | optional | now | "Enter a valid date and time." |
| Timezone | select (Intl `supportedValuesOf('timeZone')`) | | the browser's | — |

**Outputs**
- Table columns: retry # · delay min / expected / max · cumulative expected · absolute time (min to max).
- Summary: "Job reaches the Dead set after ~20.4 days (range X–Y)". Includes Sidekiq's dead-set retention
  defaults, to be verified (`dead_max_jobs` 10,000, `dead_timeout_in_seconds` 180 days).
- Timeline chart: an inline SVG drawn as part of the page. No chart library.
- Snippet: `sidekiq_options retry: N`, `sidekiq_retry_in` / `retry_on` code.

**Calculation**
- Purely deterministic: min, expected and max are computed in closed form, with no random sampling in the
  tool itself.
- Expected jitter: `4.5 × (count + 1)`. Max jitter: `9 × (count + 1)`.

**Test oracle (must pass)**
- Sidekiq default, 25 retries, no jitter: Σ_{c=0}^{24}(c⁴ + 15) = **1,763,395 s** (≈ 20.41 days).
- Expected jitter total: 4.5 × Σ(c+1) for c = 0..24 = **1,462.5 s**.
- Max jitter total: **2,925 s**.
- `retry: 0` → no retries, straight to the dead set.
- Plus one hand-checked Active Job `:polynomially_longer` case per Rails version.

**Result-aware CTA:** if the total to the dead set is over 7 days, or the retry count is above 25:
"Long retry windows hide permanent failures — the Background Job Reliability Audit covers retry policy."

**Content outline:**
1. How Sidekiq retries work.
2. The formula.
3. Transient vs permanent errors (links to the post).
4. Worked example: 25 retries.
5. Active Job vs native retries.
6. FAQ (5–7 questions).

**Search targets [A]:** "sidekiq retry schedule", "sidekiq retry calculator", "sidekiq retry time",
"active job retry_on polynomially_longer".

### 8.2 Queue capacity calculator (`job-queue-capacity-calculator`)

**Model:**
- Little's law: L = λ·W.
- M/M/c queue with c = total concurrency (processes × threads), service rate μ = 1/S (S = average job
  duration), offered load a = λ/μ, utilization ρ = a/c.
- Assumes Poisson arrivals and exponential service times. **This is shown on the page.** Real systems with
  bursts or heavy-tailed job times perform worse, which the page also says.

**Formulas:**
- Unstable if ρ ≥ 1. Backlog growth = λ − c·μ jobs/s. Time to drain a backlog B (when stable) =
  B / (c·μ − λ).
- Erlang C, via the numerically stable Erlang B recurrence: B₀ = 1, Bₖ = a·Bₖ₋₁ / (k + a·Bₖ₋₁); then
  C = B_c / (1 − ρ·(1 − B_c)).
- Average queue wait Wq = C / (c·μ − λ). P(wait > t) = C·e^(−(c·μ − λ)·t). The p95 wait solves
  P(wait > t) = 0.05: t₉₅ = ln(C/0.05) / (c·μ − λ) if C > 0.05, else 0.
- Required concurrency for a target: the smallest c with p95 wait ≤ target (search from ⌈a⌉ + 1 up).
- Peak: multiply λ by the peak multiplier and show both normal and peak.
- Database connections: c (threads) per process + headroom → chained to the pool calculator.

**Inputs and validation**

| Field | Range | Default |
|---|---|---|
| Arrival rate (+ unit /s, /min, /h) | > 0, up to 1e7/s | 600/min |
| Average duration (+ ms/s) | > 0, up to 1 h | 400 ms |
| Processes | 1–1,000 | 2 |
| Threads per process | 1–200 | 10 |
| Latency target p95 | optional, > 0 | 30 s |
| Peak multiplier | 1–20 | 1 |
| Current backlog | optional, ≥ 0 | — |

**Verdict strip** (DESIGN.md Tool Verdict):

| Condition | Verdict | Colour |
|---|---|---|
| ρ < 0.7 | OK | green |
| 0.7 ≤ ρ < 0.85 | Tight | clay, with the "tight" wording |
| ρ ≥ 0.85 or unstable | Risk | clay |

**Test oracle**
- With c = 1 it must match M/M/1: Wq = ρ/(μ − λ).
- Known Erlang C table values (e.g. a = 2, c = 3 → C ≈ 0.4444) to 4 decimal places.
- ρ ≥ 1 → flagged as unstable, never shows a negative wait.
- Converting the same rate between units gives identical results.

**Result-aware CTA:** ρ ≥ 0.85 at peak → "This is the load profile the Sidekiq / Solid Queue Scaling &
Tuning engagement is built for."

**Content outline:** queue latency vs execution time (link to the post); Little's law in plain English;
why 100% utilization means infinite wait; worked example; when the M/M/c assumptions fail; FAQ.

### 8.3 Postgres deadlock log analyzer (`postgres-deadlock-analyzer`)

**Accepted input formats** (all of them, auto-detected):

1. Postgres server log with any `log_line_prefix`. Strip everything before `ERROR:` / `DETAIL:` /
   `HINT:` / `CONTEXT:` / `STATEMENT:` markers.
2. A Rails exception message: `ActiveRecord::Deadlocked: PG::TRDeadlockDetected: ERROR:  deadlock
   detected\nDETAIL: …`, including escaped `\n` from JSON logs or error trackers.
3. A multi-line DETAIL block pasted on its own.

**Grammar to parse** (check against the Postgres 13–17 log output, `deadlock.c`):

```
ERROR:  deadlock detected
DETAIL:  Process 1201 waits for ShareLock on transaction 9001; blocked by process 1202.
Process 1202 waits for ShareLock on transaction 9000; blocked by process 1201.
Process 1201: UPDATE "accounts" SET "balance" = $1 WHERE "accounts"."id" = $2
Process 1202: UPDATE "accounts" SET "balance" = $1 WHERE "accounts"."id" = $2
HINT:  See server log for query details.
CONTEXT:  while updating tuple (0,7) in relation "accounts"
```

Lock target forms after `waits for <Mode> on`:
- `transaction N`
- `relation R of database D`
- `tuple (b,o) of relation R of database D`
- `advisory lock [D,k1,k2,f]`
- `virtual transaction V/N`

Any unrecognized form is kept as raw text, marked "unparsed", and never crashes the parser.

**Processing**
1. Normalize: unescape, strip prefixes, merge continuation lines.
2. Extract the wait edges (pid → waits for mode/target → blocked by pid), the query per pid, and the
   CONTEXT line (operation, tuple, relation).
3. Build the cycle and check it closes. If it doesn't, the input is partial: show a warning and still
   display what was found.
4. Extract tables from each statement with a lightweight SQL scan (UPDATE / INSERT INTO / DELETE FROM /
   SELECT … FOR UPDATE / FOR SHARE).
5. Classify into one of:

| Pattern | Signal |
|---|---|
| Same-table row order inversion | Same table, `ShareLock on transaction`, UPDATE/DELETE on both sides |
| Cross-table lock order inversion | Different tables in each process's statement order |
| Foreign key / parent row | INSERT on a child table + UPDATE/DELETE on a parent row, `ShareLock`/`KeyShare` patterns |
| Explicit lock / DDL involvement | `relation` targets with heavy modes (cross-references #9's data) |
| Advisory locks | `advisory lock` targets |
| Unknown | Fallback, which still explains the lock modes |

6. Fixes for each pattern, with Rails code:
   - consistent ordering: `Account.where(id: ids).order(:id).lock.to_a`
   - smaller transactions
   - `SELECT … FOR UPDATE` before the writes
   - `retry` on `ActiveRecord::Deadlocked` with a cap, for the whole transaction
   - `lock_timeout`
   - index advice for foreign keys

**Outputs**
- A cycle diagram: inline SVG built from the existing `src/components/diagram/` vocabulary where it fits.
- A table of processes.
- "What happened" in plain English.
- The diagnosis with a confidence label.
- Fix snippets.
- Links to the exact sections of `rails-deadlock-activerecord`.

**Privacy:** logs may contain real data. Parsing happens in a Web Worker on the page. The share link
contains **the analysis only, never the raw log**, unless the user explicitly ticks "include log". The
page also tells users to redact values.

**Test fixtures:** at least 8 realistic samples in `src/tools/postgres-deadlock-analyzer/fixtures/`:

| Fixture | Covers |
|---|---|
| `two-process-same-table` | the basic same-table case |
| `three-process-cycle` | a longer cycle |
| `cross-table` | lock order inversion across tables |
| `fk-parent-child` | the foreign key pattern |
| `relation-lock-ddl` | a heavy table-level lock |
| `advisory` | advisory locks |
| `rails-exception-escaped` | the Rails message with escaped newlines |
| `prefixed-server-log` | `log_line_prefix = '%m [%p] %q%u@%d '` |
| `truncated` | partial input |

Each fixture has an expected-output JSON file, and the tests diff the parser output against it.

**Result-aware CTA:** shown for any classified cycle with ≥ 3 processes or ≥ 2 tables: "Multi-table
deadlocks are what the Postgres Concurrency & Lock Review untangles." Shown for every result, in a softer
form.

### 8.4 Postgres lock mode lookup (`postgres-lock-modes`)

**Data model** (`data.ts`, typed, each entry citing the Postgres docs URL and the versions it applies to):

```ts
type LockMode = 'ACCESS SHARE' | 'ROW SHARE' | 'ROW EXCLUSIVE' | 'SHARE UPDATE EXCLUSIVE'
  | 'SHARE' | 'SHARE ROW EXCLUSIVE' | 'EXCLUSIVE' | 'ACCESS EXCLUSIVE';

interface Operation {
  id: string;                 // 'create-index'
  label: string;              // 'CREATE INDEX'
  kind: 'sql' | 'rails';      // Rails migration methods map onto SQL operations
  sqlEquivalent?: string;     // for rails: 'add_index' → 'create-index'
  locks: { object: 'table' | 'referenced table' | 'index'; mode: LockMode }[];
  pgVersions: string;         // '>=11'
  notes: string;              // impact in plain English
  saferAlternative?: string;  // 'CREATE INDEX CONCURRENTLY' / 'add_index …, algorithm: :concurrently'
  source: string;             // https://www.postgresql.org/docs/17/explicit-locking.html
}
```

**Conflict matrix** (from Postgres docs "Explicit Locking", Table 13.2; re-verify for each Postgres major
version supported). It is encoded once and drives every "does A block B?" answer. See Appendix A.

**Initial operations (minimum 30).** SQL:
- `SELECT`; `SELECT … FOR UPDATE / FOR NO KEY UPDATE / FOR SHARE / FOR KEY SHARE`
- `INSERT/UPDATE/DELETE/MERGE`
- `VACUUM`; `VACUUM FULL`; `ANALYZE`
- `CREATE INDEX`; `CREATE INDEX CONCURRENTLY`; `REINDEX`; `REINDEX CONCURRENTLY`
- `CREATE TRIGGER`; `ALTER TABLE` variants: ADD COLUMN, ADD COLUMN with volatile default, ALTER COLUMN
  TYPE, SET NOT NULL, ADD CONSTRAINT … NOT VALID, VALIDATE CONSTRAINT, ADD FOREIGN KEY, DROP COLUMN,
  RENAME
- `TRUNCATE`; `DROP TABLE`; `CLUSTER`; `REFRESH MATERIALIZED VIEW [CONCURRENTLY]`; `LOCK TABLE`

Rails:
- `add_index`, with and without `algorithm: :concurrently`
- `add_column`, `change_column`, `change_column_null`, `change_column_default`
- `add_foreign_key` (± `validate: false`), `validate_foreign_key`
- `add_check_constraint` (± `validate: false`), `remove_column`, `rename_column`, `add_reference`

**Functionality**
- Instant search, with an alias list (e.g. "index" finds CREATE INDEX and `add_index`).
- An operation detail card.
- "Compare A vs B": the verdict "B waits for A" or "No conflict", with the matrix cell highlighted.
- Row-level lock section: the four row lock modes and their conflict table.
- A note on lock queueing: a waiting ACCESS EXCLUSIVE blocks every later ACCESS SHARE. This is why
  `lock_timeout` matters for migrations.

**Test oracle**
- The matrix is symmetric and matches Appendix A exactly.
- Every Rails operation maps to an existing SQL operation.
- Every entry has a `source`.
- Snapshot tests of the compare verdicts for 10 known pairs.

**Content:** a "why your migration took the site down" worked example, linking to the deadlock and
race-condition posts.

### 8.5 Cron explainer + `recurring.yml` (`cron-expression-explainer`)

**Grammar**
- 5 fields: minute, hour, day of month, month, day of week.
- Optional 6-field form with seconds first, as sidekiq-cron accepts.
- Supported syntax: `*`, lists `,`, ranges `-`, steps `/`, names (`JAN–DEC`, `SUN–SAT`, case-insensitive),
  `7` = Sunday.
- Macros: `@yearly @annually @monthly @weekly @daily @midnight @hourly`.
- Optional trailing timezone (`0 5 * * * America/New_York`), as Fugit supports.
- **Day-of-month / day-of-week rule:** when both are restricted, a run happens if *either* matches (Vixie
  cron behaviour). The page explains this.

**Fugit natural-language subset (Solid Queue `schedule:`).** The tool accepts and explains:
- `every N minutes|hours|days`
- `every day at H(am|pm)`
- `every monday at 9am`
- `every hour`

It converts these to cron. Anything else shows "Not supported here — Fugit may still accept it", with a
link to Fugit's docs. The phrase list is checked against Fugit's specs.

**Next runs**
- The next 10 (or N up to 100) runs after the current time or a chosen start time, in the selected
  timezone.
- Calculated by stepping field-aware candidates through `Intl.DateTimeFormat` wall-clock conversion.
- Handles skipped times when clocks spring forward (no run) and repeated times when they fall back (one
  run, as Vixie cron does). Each behaviour is documented and tested.

**Generators**

```yaml
# config/recurring.yml (Solid Queue)
production:
  nightly_cleanup:
    class: CleanupJob
    queue: background
    args: [ 1000 ]
    schedule: "0 3 * * *"
```

Plus the sidekiq-cron hash or YAML (`cron:`, `class:`, `queue:`, `args:`) and a `whenever`-style
description in the written content only.

**Validation:** error messages name the field and the character position, e.g. "Field 2 (hour): 25 is
out of range 0–23".

**Test oracle**
- About 60 expression → next-run fixtures, cross-checked against a reference implementation once during
  development (e.g. Fugit or `cron-parser` run locally). That reference is **not** a runtime dependency.
- DST fixtures for `America/New_York` and `Europe/London`.
- Leap day: `0 0 29 2 *`.
- The DOM/DOW "either matches" case.

**Result-aware hook:** this is a utility tool, so there is no service CTA. It shows the newsletter box and
"Next step: how Solid Queue's scheduler works" (`how-solid-queue-works`).

---

## 9. Architecture

### 9.1 Principles

- Use what the codebase already has: Astro content collections, the `topics.ts` gating pattern,
  `BaseHead`, `Breadcrumbs`, the `PageHeader` and `Page` layout, and DESIGN.md components.
- **No new runtime framework** (no React or Vue). Interactive pieces use plain TypeScript in Astro
  `<script>` tags (bundled by Vite), as the pool calculator already does.
- **No server.** Everything is static output on Cloudflare Workers.
- **Adding a tool = one content file + one folder.** No edits to shared lists (§9.6).

### 9.2 Directory and file structure (target state after Phase 1)

```
src/
├── content.config.ts                  # + `tools` collection (blog/projects untouched)
├── content/
│   ├── blog/                          # unchanged
│   ├── projects/                      # unchanged
│   └── tools/                         # NEW: one MDX per tool (frontmatter + written content)
│       ├── postgres-lock-modes.mdx
│       ├── sidekiq-retry-calculator.mdx
│       ├── job-queue-capacity-calculator.mdx
│       ├── cron-expression-explainer.mdx
│       └── postgres-deadlock-analyzer.mdx
├── data/
│   ├── topics.ts                      # unchanged
│   └── tool-groups.ts                 # NEW: group ids, labels, tier, menu column, order, icon
├── tools/                             # NEW: one folder per tool, the code behind each widget
│   ├── _shared/
│   │   ├── hash-state.ts              # versioned #hash encode/decode + validation
│   │   ├── recent.ts                  # recently-used (localStorage, try/catch)
│   │   ├── validate.ts                # field validators + message helpers
│   │   ├── format.ts                  # number/duration/date formatting (Intl)
│   │   ├── copy.ts                    # clipboard with fallback + live-region announce
│   │   ├── worker-client.ts           # typed postMessage wrapper with timeout
│   │   └── *.test.ts
│   ├── postgres-lock-modes/
│   │   ├── Widget.astro               # markup + <script> wiring only
│   │   ├── data.ts                    # lock modes, matrix, operations (cited)
│   │   ├── logic.ts                   # search, compare, lookups (pure)
│   │   └── logic.test.ts
│   ├── sidekiq-retry-calculator/
│   │   ├── Widget.astro
│   │   ├── logic.ts
│   │   └── logic.test.ts
│   ├── job-queue-capacity-calculator/
│   │   ├── Widget.astro
│   │   ├── logic.ts                   # erlang-c, little's law
│   │   └── logic.test.ts
│   ├── cron-expression-explainer/
│   │   ├── Widget.astro
│   │   ├── parse.ts                   # grammar → AST
│   │   ├── describe.ts                # AST → English
│   │   ├── schedule.ts                # next runs, tz/DST
│   │   ├── generate.ts                # recurring.yml / sidekiq-cron
│   │   ├── fixtures/
│   │   └── *.test.ts
│   └── postgres-deadlock-analyzer/
│       ├── Widget.astro
│       ├── parse.ts
│       ├── classify.ts
│       ├── fixes.ts
│       ├── worker.ts                  # runs parse+classify off the main thread
│       ├── fixtures/                  # *.log + *.expected.json
│       └── *.test.ts
├── components/
│   └── tools/                         # NEW: shared tool UI pieces
│       ├── ToolCard.astro             # hub/menu/related card (signature + utility variants)
│       ├── ToolGrid.astro             # filterable grid (hub)
│       ├── ToolSearch.astro           # search box + chips + empty state
│       ├── ToolMenu.astro             # header dropdown / mobile accordion content
│       ├── ToolResultActions.astro    # copy / share link / download
│       ├── ToolNextSteps.astro        # chaining + related posts
│       ├── ToolServiceCta.astro       # result-aware CTA (signature only)
│       ├── ToolPrivacyBadge.astro     # "Runs in your browser"
│       ├── ToolFaq.astro              # visible FAQ (feeds FAQPage JSON-LD)
│       └── RecentTools.astro          # client-rendered, hidden when empty
├── layouts/
│   └── ToolLayout.astro               # NEW: shared tool page anatomy (§9.5)
├── pages/
│   └── tools/
│       ├── index.astro                # hub, REWRITTEN to read the collection (same URL)
│       ├── [slug].astro               # NEW: every tool page + group pages (§9.4)
│       └── connection-pool-calculator.astro   # existing static page, kept until migration (Wave 2)
└── utils/
    └── tool-schema.ts                 # NEW: JSON-LD builders (WebApplication/FAQPage/Breadcrumb)

public/
└── og/tools/<slug>.png                # share cards, made by the existing OG script pattern

scripts/
├── generate-tool-og.mjs               # NEW, modelled on generate-post-og.mjs
└── seo-regression.mjs                 # NEW: §14.8 checker (diffs built HTML of protected URLs)
```

### 9.3 Content collection schema (`src/content.config.ts` addition)

```ts
import { reference } from 'astro:content';
import { GROUP_IDS } from './data/tool-groups';

const tools = defineCollection({
  loader: glob({ base: './src/content/tools', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),                                   // H1 + card name
    seoTitle: z.string().max(60).optional(),             // <title>, keyword-first, ≤60 chars
    description: z.string(),                             // one-liner under H1 + card blurb
    seoDescription: z.string().max(160).optional(),
    tier: z.enum(['signature', 'utility']),
    group: z.enum(GROUP_IDS),
    status: z.enum(['draft', 'live']).default('draft'),  // only `live` builds a page
    order: z.number().default(100),                      // sort within group (lower first)
    featured: z.boolean().default(false),                // homepage strip + hub featured row
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),             // drives sitemap lastmod
    keywords: z.array(z.string()).default([]),           // search aliases for hub search
    versions: z.array(z.string()).default([]),           // e.g. ['Sidekiq 7.x', 'Postgres 13–17']
    relatedPosts: z.array(reference('blog')).default([]),// build fails on a bad slug
    relatedTopic: z.enum(TOPIC_SLUGS).optional(),
    nextTools: z.array(reference('tools')).max(4).default([]),
    serviceCta: z.enum(['jobs-audit', 'scaling', 'postgres-review']).optional(), // signature only
    adsEligible: z.boolean().default(false),             // stays false until the Phase 3 gate
    shareable: z.boolean().default(true),                // false for e.g. #20 credentials
    worker: z.boolean().default(false),                  // informational; widget decides
    icon: z.string(),                                    // id in a shared SVG sprite
    newUntil: z.coerce.date().optional(),                // "New" badge expiry
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }).refine((t) => t.tier === 'signature' || !t.serviceCta,
            { message: 'serviceCta is signature-only' }),
});

export const collections = { blog, projects, tools };
```

Notes:
- The `blog` and `projects` definitions are left exactly as they are.
- `reference('blog')` means a tool can only link to posts that exist, and this is checked at build time.
- Check against the installed Astro 7 that `reference()` and `.refine()` work in collection schemas. If
  `.refine` is not supported there, enforce the rule in the build check (§9.4).

### 9.4 Routing

**`src/pages/tools/[slug].astro`** builds two kinds of page:

1. **Tool pages:** every `tools` entry with `status: 'live'`, **except** slugs that have a static page in
   `src/pages/tools/`. A static route takes priority in Astro anyway; the explicit exclusion keeps the
   intent clear. Today the only such slug is `connection-pool-calculator`.
2. **Group pages:** each group with 3 or more live tools → `/tools/<group>/`.

**Build-time assertions** (throw inside `getStaticPaths` so the build fails):
- no tool slug equals a group ID
- no duplicate slugs
- `serviceCta` only on signature tools
- every `nextTools` target is `live`
- every live tool has a matching `src/tools/<slug>/Widget.astro`

**Widget lookup:**

```ts
const widgets = import.meta.glob('../../tools/*/Widget.astro', { eager: true });
// key: '../../tools/<slug>/Widget.astro' → render <Widget /> inside ToolLayout
```

**Hub (`/tools/`):** `index.astro` reads the collection instead of its hard-coded array. The URL stays the
same; the title and meta description stay the same unless the owner approves a change.

**Drafts:** `status: 'draft'` entries get no page, no sitemap entry and no hub card. Only `live` entries
appear anywhere.

### 9.5 `ToolLayout.astro` structure

```
<Page title=seoTitle description=seoDescription ogImage=/og/tools/<slug>.png>
  Breadcrumbs: Home › Tools › <Group> (link only if the group page exists) › <Tool>
  <header>  H1 title · one-liner (description) · ToolPrivacyBadge · versions line
  <section class="tool-surface">  <Widget/>   ← the tool; nothing else is placed inside this box
  ToolResultActions (copy · share link · download), wired to the widget's result
  ToolServiceCta (signature, result-aware, rendered into a reserved slot after a result)
  ToolNextSteps: nextTools cards + relatedPosts links + topic hub link
  <article class="prose">  MDX body: How it works · Worked example · Limitations/assumptions
  ToolFaq (visible; source for FAQPage JSON-LD)
  Newsletter (utility) | ServicesCta (signature, existing component)
  JSON-LD: WebApplication + FAQPage + BreadcrumbList (utils/tool-schema.ts)
  RecentTools record (client script: push slug on first successful run)
</Page>
```

The layout is responsible for the parts every tool shares. A widget is responsible only for its own inputs
and outputs, and it talks to the layout through a small DOM event contract:

| Event (dispatched on the widget root) | detail | Used by |
|---|---|---|
| `tool:result` | `{ text: string; filename?: string; mime?: string; state?: object; cta?: boolean }` | result actions, share link, recent, CTA |
| `tool:clear` | `{}` | hides result actions and the CTA |
| `tool:error` | `{ message: string }` | live-region announcement |

### 9.6 Steps to add a new tool

1. Create `src/content/tools/<slug>.mdx` with frontmatter (§9.3) and the written content (§14.4), and
   `status: draft`.
2. Create `src/tools/<slug>/` containing `Widget.astro`, `logic.ts` and `logic.test.ts`, plus
   `worker.ts` and `fixtures/` if needed.
3. `npm test` passes, and `npm run build` passes, including the build assertions.
4. Generate the OG card (`node scripts/generate-tool-og.mjs <slug>`).
5. Run the checklists in §10.8.
6. Set `status: live`. The hub, menus, group pages, related cards, sitemap and JSON-LD all pick it up
   automatically.

---

## 10. Frontend, logic, Web Workers, testing

### 10.1 Separation of concerns

- `logic.ts` (and siblings) contain **pure functions only**: no DOM, no `window`, no `Date.now()`
  without injection. Time, randomness and locale are passed in as arguments, so every function can be
  tested.
- `Widget.astro` is markup plus a `<script>` that reads inputs, calls the logic and renders outputs.
- Heavy or untrusted parsing runs in `worker.ts` (§10.3).

### 10.2 TypeScript rules

- Use only TypeScript syntax that can simply be erased (no `enum`, no `namespace`, no parameter
  properties), so the tests can run under Node's type stripping (§10.6).
- Use `.ts` extensions in imports between tool modules. Confirm `tsconfig` allows this, and if it doesn't,
  record the fix in §17.
- Use discriminated-union result types (`{ ok: true; value } | { ok: false; errors: FieldError[] }`)
  instead of throwing, for anything triggered by user input.

### 10.3 Web Workers

- Use a worker when a parser takes untrusted text larger than about 100 KB, or work that can take more
  than 50 ms: deadlock analyzer, log analyzer, JSON formatter for large inputs, diff, EXPLAIN viewer.
- Load it with the standard Vite pattern:
  `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`.
- `_shared/worker-client.ts`: request IDs, a timeout (default 10 s, which shows "Input too large or
  complex"), cancellation when new input arrives (debounced at 250 ms), and a fallback to the main thread
  if workers are unavailable.
- Input size caps for each tool, enforced in both the UI and the worker (e.g. 5 MB for logs).

### 10.4 Validation and error handling

- Validate on input (debounced) and on submit. Messages sit next to the field, linked with
  `aria-describedby` and styled with the clay error rule from DESIGN.md.
- Never show `NaN`, `Infinity`, `undefined` or a stack trace. Every output path has a test proving it
  doesn't.
- Parsers return partial results with warnings instead of failing outright when that's possible.
- One `role="status"` live region per tool announces results and errors (the pattern the pool calculator
  already uses).

### 10.5 Performance budgets

| Metric | Budget |
|---|---|
| Tool JS (gzip) excluding lazy libraries | ≤ 50 KB |
| Lazy library (YAML, SQL formatter) | ≤ 120 KB, loaded on first use |
| LCP (mobile, 4G) | ≤ 2.0 s |
| CLS | ≤ 0.05 (reserve the result area's height) |
| INP | ≤ 200 ms, including paste of the maximum input size |
| Hub page JS | ≤ 15 KB (search + filters + recents) |

### 10.6 Testing strategy

| Layer | Tool | Scope |
|---|---|---|
| Unit | **`node:test`** (built into Node), run with `node --test --experimental-strip-types` | All `logic`, `parse`, `schedule` and `_shared` modules. Known answers from §8 and fixtures |
| Fixture / snapshot | `node:test` + `*.expected.json` | Parsers (deadlock, cron, later log/EXPLAIN/migration) |
| Build integrity | `astro build` + assertions in `getStaticPaths` | Schema, references, slug collisions, widget presence |
| SEO regression | `scripts/seo-regression.mjs` (§14.8) | Protected URLs are unchanged |
| Browser checks | Manual checklist (§10.8) in Chrome, Safari and Firefox, at 320 / 768 / 1280 px, both themes | UI wiring, keyboard, screen reader spot check |
| Optional, later | Playwright, only if manual checks become a bottleneck (§17) | Smoke test each tool |

- Proposed script: `"test": "node --test --experimental-strip-types \"src/tools/**/*.test.ts\""`.
- Node 22.12 supports `--experimental-strip-types` (added in 22.6). Confirm the glob and import behaviour
  in Phase 1, and if it fails, choose between upgrading Node and adding `vitest` as a dev dependency.
  Record the choice in §17.
- **No test runner dependency is added unless that check fails.**

### 10.7 Accessibility

- Every input has a visible `<label>`. Units sit in the label or next to the field, not only in the
  placeholder.
- Keyboard: Tab order follows the visual order; Enter runs the tool; Escape clears search; `/` focuses
  hub search (not inside inputs).
- Results are not shown by colour alone: verdicts always have an icon and text (the Tool Verdict rule in
  DESIGN.md).
- Charts and diagrams have a text or table equivalent.
- Contrast is AA in both themes, including syntax-coloured output.
- `prefers-reduced-motion` is respected.

### 10.8 Definition of Done (each tool)

- [ ] All inputs validated, with field-level messages; impossible inputs are rejected or explained.
- [ ] Calculations and parsing match the test oracle in §8 / §7; `npm test` passes.
- [ ] The versions the tool targets are listed on the page and the behaviour matches each one (source
      references in the code).
- [ ] Worker used where §10.3 requires it; maximum input size tested.
- [ ] Copy, share link, recent and reset all work; the share link round-trips exactly.
- [ ] Written content complete (§14.4); FAQ visible; JSON-LD valid (Rich Results Test / Schema validator).
- [ ] OG card generated.
- [ ] Manual check done: 3 browsers, 3 widths, both themes, keyboard only, VoiceOver spot check.
- [ ] Performance budget met (Lighthouse mobile).
- [ ] CSP header active and no console errors.
- [ ] `npm run security:check` passes:
  - all headers present
  - no unhashed inline scripts
  - no banned APIs, and `set:html` only from the allowlist
  - no `.map` files, dotfiles, drafts or secrets in `dist/`
  - `npm audit` clean at high or above
- [ ] After deploy: `npm run security:live` passes for the new URL.
- [ ] No new dependency, or a new one that passes §11.1 item 8: licence, size, pinned version, recorded
      in §17.
- [ ] SEO regression check (§14.8) is clean.
- [ ] Linked from the related posts (callouts) and the topic hub, after the owner approves those edits to
      the posts (§13.2).

---

## 11. Security, privacy, browser-only processing

Scope: the **whole site and its supply chain**, not only `/tools/*`. The stack is static Astro 7 output on
Cloudflare Workers, with no backend, database or logins. The realistic threats are:
- XSS through injected scripts or markup
- defacement through a compromised build, dependency, deploy token or account
- domain or DNS takeover
- clickjacking
- automated scanning and scraping

### 11.0 Current security state (verified 2026-11-26)

| Check | Result | Status |
|---|---|---|
| Response security headers on `/` (HSTS, CSP, XFO, XCTO, Referrer-Policy, Permissions-Policy, COOP) | **None present.** Only `server: cloudflare` | ✕ Fix in Phase 0 (S0-4) |
| HTTP → HTTPS | `301` to `https://danialasghar.com/` | ✓ |
| `/.git/HEAD`, `/.env` | `403` (blocked at the edge; see `docs/cloudflare-waf-rules.md`) | ✓ |
| Source maps (`*.map`) or dotfiles in `dist/` | None | ✓ |
| DNSSEC | **No DS record published** | ✕ Owner action (S0-1) |
| Registrar transfer lock | `clientTransferProhibited` | ✓ |
| HSTS preload list | Not listed (`status: unknown`) | Decision D10 |
| `npm audit --audit-level=high` | **12 advisories: 1 critical (`astro`: reflected XSS via View Transition animation properties) and 11 high** (`devalue`, `fast-xml-parser`, `js-yaml`, `nanoid`, `postcss`, `sharp`, `smol-toml`, `source-map-js`, `svgo`, `vite`, `zod`). All have fixes that need no major version upgrade | ✕ Fix in Phase 0 (S0-3) |
| CI | No `.github/` directory, so there is no CI and no Dependabot | ✕ Phase 0 (S0-5, S0-6) |
| Inline scripts per page (homepage) | 3 `type="module"` and 2 classic inline scripts (theme toggle, header, newsletter), plus JSON-LD data blocks | Needs CSP hashes (§11.5) |
| `set:html` / `innerHTML` in `src/` | `set:html` only with build-time content: JSON-LD, author SVG diagrams, topic intros. One `innerHTML` with a constant string in `connection-pool-calculator.astro` | Allowlist + migrate (§11.6) |
| `PUBLIC_*` variables | `PUBLIC_CF_BEACON_TOKEN`, `PUBLIC_GISCUS_*`, all public identifiers | ✓ |
| Analytics beacon live | Not present on the live homepage (token not set at build time) | — (§11.5) |

### 11.1 Requirements

1. **Nothing the user enters leaves the browser.**
   - No `fetch`, XHR, WebSocket or beacon calls carrying tool data.
   - Analytics (the Cloudflare beacon) sends pageviews only, never tool inputs.
2. **Share links use only the URL `#hash`**, which browsers never send to the server. They never use the
   query string, which can end up in logs and analytics.
3. **Recently used** stores **only tool slugs** in `localStorage`, never inputs.
4. **Content-Security-Policy.** The site-wide policy (§11.5) applies to `/tools/*`, with tool-specific
   tightening:
   - `worker-src 'self'` for tools that use Web Workers.
   - Tools that must never touch the network (#20 credentials) get a per-path override with
     `connect-src 'none'`.
5. **Treat all pasted input as untrusted text.**
   - Never insert it as HTML (`textContent` only; no `innerHTML` with user data).
   - No `eval` / `new Function`.
   - Regexes built from user input (#37) run in a worker with a timeout, to contain runaway patterns
     (ReDoS).
6. **Local files** (e.g. #18 logs, #24 JSON) are read with `FileReader` and never uploaded. Max size is
   enforced before reading.
7. **Secrets** (JWT secrets, webhook secrets, master keys):
   - Fields are `type="password"` with a show toggle and `autocomplete="off"`.
   - Never included in share links.
   - Cleared when the user leaves the page.
   - The page explains this.
8. **Dependencies.** Each new library needs: a licence check (MIT, BSD or Apache only; **no AGPL or
   GPL**), a size check, a pinned version, and an entry in §17.
9. **Other headers:** site-wide, as specified in §11.4.

### 11.2 Privacy policy

- **Phase 1:** add a short "Developer tools" section to `/privacy/`: processing happens in the browser,
  nothing is sent or stored, recents are kept locally, and share links use the URL hash. The page
  already mentions "in-browser developer tools" in its meta description.
  - This is a content edit to an existing page and **needs owner approval** (§1 rule 12). It does not
    change the URL or the SEO title.
- **No terms page is needed while there are no ads, no accounts and no server.** One is added at the
  Phase 3 AdSense gate (§15.4).

### 11.3 How the browser-only promise appears

`ToolPrivacyBadge` reads "Runs in your browser — nothing you enter leaves this page" and links to
`#how-it-works`, where each tool's written content says specifically what happens to the data (e.g. "The
log is parsed in a Web Worker in this tab").

### 11.4 Site-wide HTTP security headers

Delivered through `public/_headers`. The live site honours that file (DEC-13). The `/*` rule applies to
every route; more specific rules only add to it.

```
/*
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload   # final stage, see rollout
  Content-Security-Policy: <generated, §11.5>
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Cross-Origin-Opener-Policy: same-origin
  Permissions-Policy: accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), midi=(), payment=(), publickey-credentials-get=(), serial=(), usb=(), xr-spatial-tracking=(), browsing-topics=()
```

- **`X-Frame-Options: DENY`** sits alongside CSP `frame-ancestors 'none'`. Older browsers use the first,
  current ones use the second.
- **`Cross-Origin-Embedder-Policy` is not set.** It would block cross-origin embeds without any security
  gain for a static site. Revisit only if a tool needs `SharedArrayBuffer`.
- **The existing `Cache-Control` rules** for `/_astro/*` and `/fonts/*` stay as they are and combine with
  `/*`. Verify in Phase 0 that Cloudflare merges both rules (A15).

**HSTS rollout.** This is order-sensitive, and the last step is hard to undo.

1. Before step 1, check that **every subdomain** of `danialasghar.com` that resolves (e.g. `www`, mail
   or verification records) serves HTTPS. `includeSubDomains` breaks any that don't.
2. Stage 1: `max-age=300` (5 minutes), without `preload`. Deploy, run `security:check`, and keep it for
   1 day.
3. Stage 2: `max-age=604800` (1 week) with `includeSubDomains`. Keep for 1–2 weeks.
4. Stage 3: `max-age=63072000; includeSubDomains; preload`.
5. Stage 4: submit to hstspreload.org **only with explicit owner approval** (D10). Leaving the preload
   list takes months and makes plain HTTP impossible for the domain and every subdomain.

Each stage is a separate commit, and the first deploy that changes HSTS needs explicit permission (rule
16).

### 11.5 Content-Security-Policy strategy (no `'unsafe-inline'` for scripts)

**Target policy** (site-wide; tools add only what they need):

```
default-src 'self';
script-src 'self' <sha256 hashes of every inline script in dist/>;
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
worker-src 'self';
manifest-src 'self';
frame-src 'none';
frame-ancestors 'none';
object-src 'none';
base-uri 'self';
form-action 'self' <newsletter form endpoint, verified in Phase 0>;
upgrade-insecure-requests
```

- **How hashes are produced.** A post-build step, `scripts/csp-hashes.mjs`:
  1. scans every `dist/**/*.html` for executable inline `<script>` elements (JSON-LD
     `type="application/ld+json"` data blocks are skipped; they don't execute)
  2. computes `sha256-…` for each
  3. writes the final `Content-Security-Policy` line into `dist/_headers`

  The build fails if the header would exceed Cloudflare's header size limit (A16).
  - **Alternative:** Astro's own CSP support, if the installed Astro 7 has it (A17). It emits a per-page
    `<meta http-equiv>` tag, which **cannot carry `frame-ancestors`**, so the header approach stays
    primary. The choice is recorded in §17.
- **Keep the hash count small.** Prefer bundled external scripts (`<script>` that Astro processes) over
  `is:inline`. The theme script that prevents a flash of the wrong theme must stay inline, and is hashed.
- **`style-src 'unsafe-inline'` is kept deliberately.** Astro emits inline style attributes and
  `<style>` blocks. Style injection without script execution is a much lower risk. Revisit in Phase 4.
- **Newsletter (MailerLite):** the form posts to a third-party endpoint. Its exact origin is added to
  `form-action` (and to `connect-src` if it's submitted via `fetch`). Verify in Phase 0 which one the
  `nl-form` script uses.
- **Cloudflare Web Analytics beacon** (only when `PUBLIC_CF_BEACON_TOKEN` is set at build time; it isn't
  live today):
  - Allow `https://static.cloudflareinsights.com` in `script-src` and `https://cloudflareinsights.com`
    in `connect-src`.
  - **SRI:** Cloudflare serves `beacon.min.js` at an unversioned URL that changes over time, so an SRI
    hash would break silently. Options (decision D11):
    - (a) a versioned beacon URL with SRI, if Cloudflare publishes a stable one
    - (b) record an explicit exception: first-party infrastructure, origin pinned in CSP
    - (c) Cloudflare's automatic injection at the edge, which then also needs a CSP allowance
- **Report-only first.** Ship the CSP as `Content-Security-Policy-Report-Only` for one deploy, confirm no
  violations in the browser console across the page checklist, then switch to enforcing.

### 11.6 XSS and untrusted input rules (blog and tools)

| Pattern | Rule |
|---|---|
| `eval`, `new Function`, `setTimeout("…")`, `setInterval("…")` | Banned everywhere |
| `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` | Banned. Use `textContent`, `createElement` and `replaceChildren`. The existing `innerHTML` in `connection-pool-calculator.astro` (constant string) is migrated in Wave 2 (#10); until then it's on the allowlist |
| `set:html` | Allowed **only** on the allowlist below. Each use renders build-time, author-controlled content, never URL, hash, storage or user input |
| JSON-LD via `set:html={JSON.stringify(x)}` | Must use a `jsonLd()` helper that escapes `<`, `>`, `&`, U+2028 and U+2029 (so a `</script>` inside a frontmatter string can't break out of the tag). Migrate every existing call in Phase 0 (S0-7) |
| URL / `#hash` / `localStorage` values | Parsed and validated by the tool's validators (§12.6). Inserted only as text |
| User-supplied links | Never rendered as `href` unless the scheme is `https:`/`http:` and the user chooses it |

**`set:html` allowlist** (as of 2026-11-26). `security:check` fails on any `set:html` not listed here:

| File | Content |
|---|---|
| `src/components/BaseHead.astro` | JSON-LD |
| `src/components/Breadcrumbs.astro` | JSON-LD |
| `src/layouts/BlogPost.astro` | JSON-LD |
| `src/layouts/CaseStudy.astro` | JSON-LD |
| `src/pages/services.astro` | JSON-LD |
| `src/pages/tools/connection-pool-calculator.astro` | JSON-LD |
| `src/pages/topics/index.astro` | JSON-LD |
| `src/pages/topics/[slug].astro` | JSON-LD, and author HTML intro paragraphs from `src/data/topics.ts` |
| `src/components/diagram/figures/*.astro` (4 files) | Author SVG, imported at build time |
| `src/layouts/ToolLayout.astro` (Phase 1) | JSON-LD via the `jsonLd()` helper |

### 11.7 Supply chain and build pipeline

- **Lockfile:** `package-lock.json` is committed. CI and Cloudflare builds use **`npm ci`**, never
  `npm install`. Check that the Cloudflare build command uses `npm ci` (A18).
- **Audit gate:** `npm audit --audit-level=high` runs in CI and in `security:check`. A high or critical
  advisory blocks a merge unless it's recorded in §17 as not exploitable in this static build, with a
  review date.
- **Exact versions:** pin direct dependencies to exact versions (`"astro": "7.0.x"`, no `^`). Updates
  come only through automated PRs.
- **Automated updates:** Dependabot (`.github/dependabot.yml`):
  - weekly npm and GitHub Actions updates, grouped
  - **cooldown:** new releases must be 7 days old (3 days for security updates) before a PR opens; use
    Dependabot's `cooldown` option, or Renovate's `minimumReleaseAge` if switching (A19)
- **Minimal runtime:** no UI framework and no client-side npm packages, apart from the lazy-loaded tool
  libraries in §7, each approved through §11.1 item 8.
- **Install scripts:** CI runs `npm ci --ignore-scripts`, followed by an explicit rebuild of the packages
  that need native install steps (`sharp`, `esbuild`), so new transitive dependencies can't run install
  scripts silently (A20).
- **CI workflow:** `.github/workflows/ci.yml`, on every push and PR:

  `npm ci` → `npm audit --audit-level=high` → `npm test` → `astro build` → `seo:check` →
  `security:check --dist`

  Use least-privilege `permissions: contents: read`, and pin actions to commit SHAs.

### 11.8 Infrastructure, DNS and accounts (owner actions; Claude cannot do these)

| # | Action | Where | Verify |
|---|---|---|---|
| I-1 | Passkey or hardware-key 2FA. Remove SMS fallback. Store recovery codes offline | Cloudflare, domain registrar, GitHub, MailerLite | Account security pages |
| I-2 | **Enable DNSSEC** (currently off) and publish the DS record at the registrar | Cloudflare DNS → DNSSEC | `dig +short DS danialasghar.com` returns a record |
| I-3 | Keep the registrar lock (currently on) | Registrar | whois `clientTransferProhibited` |
| I-4 | SSL/TLS mode **Full (Strict)**, minimum TLS 1.2, Always Use HTTPS on | Cloudflare SSL/TLS | Dashboard; `security:check` live mode |
| I-5 | WAF managed rules on. **Bot Fight Mode** on. Keep the existing custom rules (`docs/cloudflare-waf-rules.md`) | Cloudflare Security | Dashboard |
| I-6 | Deploy token: **scoped Cloudflare API token** ("Workers Scripts: Edit" on this account only), never the Global API Key. Rotate yearly | Cloudflare API Tokens; CI secrets | Token list |
| I-7 | No secrets in `PUBLIC_*`, in the repo or in `dist/`. Secret scanning and push protection on | GitHub settings | `security:check` grep; GitHub |
| I-8 | CAA DNS records restricting which certificate authorities may issue for the domain | Cloudflare DNS | `dig CAA danialasghar.com` |
| I-9 | Remove dangling DNS records (subdomains pointing at services no longer used), to prevent subdomain takeover | Cloudflare DNS | Review the record list |
| I-10 | Cloudflare account audit log and email alerts for DNS, SSL and Workers changes | Cloudflare Notifications | Dashboard |

### 11.9 Git and deployment

- **Branch protection on `main`:**
  - no force pushes, no deletion
  - required status check: the CI workflow
  - linear history
- **Conflict to resolve:** the owner has also allowed direct pushes to `main` (rule 16). Branch
  protection must either let the owner and agent push directly when checks pass (an admin bypass with
  required checks), or require PRs, which turns rule 16 into "open the PR, wait for CI, merge". Decision
  D12.
- **Signed commits:** require signed commits on `main` once the owner has an SSH signing key configured
  locally (`gpg.format=ssh`, `user.signingkey`, `commit.gpgsign=true`). Until then, agent commits are
  unsigned and **enabling "require signed commits" would block them**. Decision D13.
- **Deploys:** only from `main` through Cloudflare's Git integration or CI with the scoped token (I-6).
  No manual `wrangler deploy` from a laptop with broad credentials.
- **GitHub:** 2FA required for the account; Actions limited to verified creators and pinned SHAs;
  `GITHUB_TOKEN` read-only by default.

### 11.10 `security:check`

`scripts/security-check.mjs`, built in Phase 0. No dependencies. Two modes:

**Build mode** (`--dist`, runs in CI and before every merge):
1. `dist/_headers` contains every required header from §11.4 on `/*`, and the CSP has no
   `'unsafe-inline'` or `'unsafe-eval'` in `script-src`.
2. Every executable inline script in `dist/**/*.html` has a hash in the CSP.
3. Nothing in `dist/` that shouldn't be there:
   - `*.map` files, dotfiles or dot-directories (`.git`, `.env*`), `node_modules`
   - draft content (any built page for a `draft: true` post or tool)
   - files matching secret patterns (private keys, `AKIA…`, `ghp_…`, `sk_live_…`, high-entropy
     `TOKEN=`)
4. A source scan of `src/` for the banned APIs in §11.6, with `set:html` checked against the allowlist.
5. Every external `<script src>` is on the allowed origin list, and has `integrity` unless covered by a
   §17 exception.
6. `npm audit --audit-level=high` passes.

**Live mode** (`--live https://danialasghar.com`, run after every deploy and weekly):
1. `curl -I`-equivalent requests to a sample of routes (`/`, a post, a topic, `/tools/`, a tool, `/404`)
   check that every required header is present and that HSTS matches the current rollout stage.
2. `http://` returns a 301 to `https://`.
3. `/.git/HEAD`, `/.env`, `/package.json`, `/src/` and any `*.map` path return 403 or 404.
4. DNS: a DS record exists (DNSSEC), and CAA records exist. Reported as a warning until I-2 and I-8 are
   done.

Exit codes: 0 pass, 1 fail, 2 setup error. Scripts: `npm run security:check` (build mode) and
`npm run security:live`.

---

## 12. Discovery experience

### 12.1 Header: Tools dropdown

- Built on the redesign header (`Header.astro`). **"Tools" becomes a disclosure button**, opened by click
  or tap, with `aria-expanded` and `aria-controls`. It is not hover-only. Escape closes it and focus
  returns to the button.
- A desktop panel with 4 columns (from `tool-groups.ts` `menuColumn`):

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ JOBS & QUEUES          POSTGRES               RAILS & AI          DEV UTILITIES │
│ Retry calculator       Deadlock analyzer      Puma calculator     JSON formatter│
│ Queue capacity         Lock modes             Rails log analyzer  JWT decoder   │
│ Backoff & jitter       Pool calculator        LLM rate planner    Cron explainer│
│                        Safe migrations                            Timestamp     │
│ ───────────────────────────────────────────────────────────────────────────── │
│ All 47 tools →                         Runs in your browser · nothing uploaded │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Up to 4 live tools per column, chosen by `featured` and then `order`. Columns with no live tools are
  hidden. With only Wave 1 live, the panel shows 3 columns.
- **Mobile:** a "Tools" accordion inside the existing mobile menu: groups, then tools, then "All tools".
- The topic sub-bar stays as it is. **No "Writing" dropdown**; the topic bar already does that job.
- The current-page state follows DESIGN.md (ruby text plus the 2px rule) on `/tools/*`.

### 12.2 Tools hub (`/tools/`)

```
┌───────────────────────────────────────────────────────────────────┐
│ Tools                                                             │
│ H1  Developer tools for Rails, Postgres & background jobs         │
│ lede  Free, precise, and private — everything runs in your browser│
│ [ 🔍 Search tools… JWT, cron, deadlock              /  ]          │
│ (All 47) (Jobs & Queues 7) (Postgres 9) (Rails 4) (AI 3)          │
│ (Data 4) (Encoding 5) (Time & IDs 4) (Code 4) (HTTP 5) (Infra 2)  │
├───────────────────────────────────────────────────────────────────┤
│ Recently used:  Cron explainer · Lock modes          (hidden if ∅)│
├───────────────────────────────────────────────────────────────────┤
│ BUILT FOR RAILS & POSTGRES RELIABILITY            (signature row) │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│ │ icon         │ │ icon         │ │ icon         │ │ icon       │ │
│ │ Deadlock     │ │ Retry        │ │ Queue        │ │ Lock modes │ │
│ │ analyzer     │ │ calculator   │ │ capacity     │ │            │ │
│ │ one-liner    │ │ one-liner    │ │ one-liner    │ │ one-liner  │ │
│ │ Postgres·New │ │ Sidekiq 7–8  │ │ Little's law │ │ PG 13–17   │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
├───────────────────────────────────────────────────────────────────┤
│ DEVELOPER UTILITIES                             (compact grid)    │
│ Data formats   · JSON formatter · JSON ↔ YAML · JSON → Ruby …     │
│ Time & IDs     · Cron explainer · Timestamp · UUID/ULID …         │
│ …                                                                 │
├───────────────────────────────────────────────────────────────────┤
│ How these tools work (privacy) · Suggest a tool (mailto)          │
│ ServicesCta (existing)                                            │
└───────────────────────────────────────────────────────────────────┘
```

**Hub behaviour**
- **Search:**
  - Uses an index of title, description, keywords and group, built at build time and embedded in the
    page as JSON. That's under 10 KB for 47 tools, so no extra request is needed.
  - Matching: normalized substring and word-prefix scoring (title > keywords > description).
  - Results update as the user types (debounced at 80 ms).
  - Empty state: "No tool for 'xyz' yet — suggest it", with a mailto link.
- **Filter chips:**
  - Filtering happens on the page itself (like iLovePDF's `data-filter`) and is kept in the `#group=`
    hash, so filtered views don't create indexable duplicate URLs.
  - Chip counts show live tools only.
  - The page works without JavaScript: all cards are rendered, with real links.
- **Cards:** an icon (SVG sprite), the title, a one-liner, a meta line (versions or group), and badges
  (**New** until `newUntil`, **Browser-only**, **Rails**).
  - Signature cards are larger; utility cards are compact rows or tiles.
  - The whole card is one link.
- **Ordering:** featured, then `order`, then title.
- **Server-rendered:** the hub is fully rendered at build time, so every card is crawlable. JS only adds
  filtering and search.

### 12.3 Group pages (`/tools/<group>/`, created only with 3+ live tools)

- Group H1 and a 2–3 paragraph original introduction, written like the topic hub intros.
- The cards in that group.
- Related topic hub and posts.
- ItemList and BreadcrumbList JSON-LD.

### 12.4 Tool page layout

```
Home › Tools › Postgres › Deadlock analyzer
H1 Postgres Deadlock Analyzer
Paste a deadlock error and see the lock cycle, the cause, and the fix.
[🔒 Runs in your browser]  Postgres 13–17 · ActiveRecord 7–8
┌ tool surface ───────────────────────────────────────────────┐
│ inputs …                                     [Analyze]      │
│ ─────────────────────────────────────────────────────────── │
│ result (verdict strip, diagram, tables)  [Copy] [Share] [⬇] │
└─────────────────────────────────────────────────────────────┘
(result-aware service CTA, appears after a qualifying result)
Next steps:  Lock modes → · Read: Fixing Rails Deadlocks → · Database Reliability hub →
How it works · Worked example · Limitations
FAQ
ServicesCta / Newsletter
```

### 12.5 Chaining between tools (iLovePDF's "continue to")

- `nextTools` in the frontmatter lists up to 4 next steps, shown after a result appears and also as static
  links lower on the page.
- **Carrying data forward:** where it makes sense, the next-step link includes the result as hash state
  for the next tool, which pre-fills it. Examples:

| From | To | What carries over |
|---|---|---|
| #2 queue capacity | #10 pool calculator | `#threads=…&processes=…` |
| #4 Sidekiq planner | #10 pool calculator | concurrency |
| #17 Puma | #10 pool calculator | threads |
| #24 JSON formatter | #25 JSON ↔ YAML / #26 JSON → Ruby | JSON input, only if smaller than about 8 KB; otherwise just a link |
| #8 deadlock analyzer | #9 lock modes | `#mode=ShareLock` |

- **Planned chains:**

| Chain | Steps |
|---|---|
| Deadlocks | #8 → #9 → `rails-deadlock-activerecord` |
| Job capacity | #2 → #10 → #4 |
| Retries | #1 → #3 → #7 |
| Scheduling | #33 → `how-solid-queue-works` |
| JSON | #24 → #25 → #26 |
| Webhooks | #28 → #29 |
| Migrations | #11 → #9 → #12 |
| Logs | #18 → #14 → #38 |

### 12.6 Share links (hash state)

- Format: `#v=1&<key>=<value>…`. URL-encoded and versioned, so an old link still works after a tool
  changes. Each tool defines the keys it accepts.
- Decoding goes through each tool's validators. Invalid values are dropped, with a notice. Hash data is
  never trusted blindly.
- Size limit of about 2,000 characters. Larger states (logs) are never put in the hash; the analysis
  summary is shared instead (§8.3).
- Tools with `shareable: false` hide the Share button.

### 12.7 Recently used

- `localStorage` key `da:tools:recent`, holding an array of up to 6 slugs, most recent first. All access is
  wrapped in try/catch, and the page renders correctly without it.
- A slug is recorded on the **first successful result** of a visit, not on page view.
- Shown on the hub ("Recently used") and in the menu footer, both drawn by JS after load. They are hidden
  when empty, and their space is reserved only when something exists, so the layout doesn't jump.
- A "Clear" link. No other data is stored.

### 12.8 Later (Phase 4)

- A ⌘K / Ctrl-K command palette on every page, loading the search index JSON
  (`/tools/search-index.json`, built at build time) on first use.
- Pagefind, only if there are more than about 60 tools or full-text search over the written content is
  wanted.

---

## 13. Cross-promotion and internal linking

### 13.1 How the pieces feed each other

```
Search ──► Article ──callout──► Signature tool ──result-aware CTA──► /services/ ──► email
   │          ▲                      │
   │          └──── "Why this works" ┘
   ├──► Signature tool ──next steps──► Article / Topic hub / other tools
   └──► Utility ──next steps / related──► Signature tool / Article ──► Newsletter
```

### 13.2 Article → tool callouts

- A callout component at the exact paragraph where the problem appears. For example, in
  `rails-connection-pool-exhaustion`, next to the sizing formula: "Run your numbers: Connection Pool
  Calculator →", with the article's example numbers in the link's hash.
- **These are body edits to existing posts.** They need owner approval for each post. Frontmatter,
  titles, descriptions and JSON-LD stay untouched. Changing `updatedDate` only for a callout is **not**
  done (it would be a misleading freshness signal) unless the owner decides otherwise.
- The planned callouts:

| Post | Tool(s) |
|---|---|
| `sidekiq-retry-strategy-transient-vs-permanent-failures` | #1, #3 |
| `sidekiq-job-runs-twice-at-least-once-delivery` | #1, #7 |
| `why-background-jobs-are-slow` | #2, #18 |
| `solid-queue-vs-sidekiq` | #2, #33 |
| `how-solid-queue-works` | #33 |
| `idempotent-ai-workers-rails` | #22, #6 |
| `rails-connection-pool-exhaustion` | #10, #17, #12 |
| `rails-deadlock-activerecord` | #8, #9 |
| `postgres-race-conditions-row-locks-rails` | #9, #8, #15 |

### 13.3 Tool → article

- Each tool's `relatedPosts` produces a "Read the guide" block. The written content links to the specific
  section anchors (the site already generates heading anchors).

### 13.4 Topic hubs

- `/topics/<slug>/` gains a "Tools for this topic" block listing the live tools whose `relatedTopic`
  matches.
- This is a template change to `src/pages/topics/[slug].astro`. It's additive: hub titles, meta and intro
  text stay the same.

### 13.5 Services

- **Result-aware CTAs (signature tools only):**
  - Shown after a result that meets the condition, in a reserved slot below the result.
  - Never a popup. Never shown before the user has a result.
  - Specific, helpful wording (examples in §8). It names the matching service and links to
    `/services/#<id>`. Check that the services page has those anchors.
- **Services page:** a "Free tools I use in audits" block linking to the signature tools. This is an
  additive edit to the services page and needs owner approval.
- **Case studies** may link to tools when they are genuinely relevant.

### 13.6 Measuring leads (privacy-friendly)

- Cloudflare Web Analytics can't track custom events [A].
- **Proposal:** service CTA mailto links pre-fill the subject: `Re: <Tool name> — <service>`. That
  identifies leads that came from a tool without any tracking.
- Alternatively, a referrer check on `/services/`. This is an open decision (§19).

### 13.7 Newsletter and homepage

- **Newsletter:** one issue per new signature tool. A launch post (an actual article, e.g. "How to read a
  Postgres deadlock log") is published alongside major tools; it's genuine content, not an
  announcement.
- **Homepage:** a "Tools" strip showing 3–4 `featured` signature tools and "All tools →", placed after
  "Start here" and before the topics. Utilities never appear on the homepage.

### 13.8 Footer

- A "Tools" column: the signature tools marked `featured` plus "All tools".

---

## 14. SEO, structured data, indexing, content requirements

### 14.1 Titles and meta descriptions

- `seoTitle` ≤ 60 characters, keyword-first, with no brand suffix if space is short. Examples:
  - "Sidekiq Retry Schedule Calculator — Every Retry Time"
  - "Postgres Deadlock Analyzer — Find the Lock Cycle"
- `seoDescription` 140–160 characters, stating the benefit and that it's private ("runs in your
  browser").
- H1 = the tool's name; the one-liner sits directly beneath it.

### 14.2 Structured data (`utils/tool-schema.ts`)

- **WebApplication**, with:
  - `name`, `description`, `url`
  - `applicationCategory: "DeveloperApplication"`
  - `operatingSystem: "Web"`, `browserRequirements: "Requires JavaScript"`
  - `isAccessibleForFree: true`
  - `offers: { price: "0", priceCurrency: "USD" }`
  - `author`/`creator: { "@id": site#person }` (the Person entity already used site-wide)
  - `datePublished`/`dateModified`
- **FAQPage**, only with FAQs that are visible on the page. Since 2023 Google shows FAQ rich results only
  for a limited set of sites [A]. The markup is still valid and consistent with the site's posts.
- **BreadcrumbList**, via the existing breadcrumb utilities.
- **Hub and group pages:** `CollectionPage` + `ItemList` of the tool URLs.
- **Not used:** `HowTo` (Google removed its rich results), and `aggregateRating` (no real ratings; never
  fake them).
- The existing pool calculator keeps its current `SoftwareApplication` JSON-LD until it is migrated in
  Wave 2. Switching it to `WebApplication` then needs owner approval.

### 14.3 Indexing

- Live tools are added to the sitemap automatically by `@astrojs/sitemap`.
- **Sitemap lastmod for tools:** extend the existing `serialize` in `astro.config.mjs` to read tool
  `updatedDate ?? pubDate`. The blog `lastmod` logic must keep producing identical output; the SEO
  regression check confirms it.
- Drafts aren't built. No `noindex` pages. Every tool canonicals to itself, with a trailing slash.
- Hash state never changes the canonical URL, and `#` is never indexed.
- Group pages are only generated with 3+ tools, so thin pages are never indexed.
- After each launch: submit the URL in Search Console (manual step).

### 14.4 Written content requirements (each tool page)

| Section | Signature | Utility |
|---|---|---|
| How it works (mechanism, formulas or grammar, what happens to your data) | Required | Required |
| Worked example with real numbers or input | Required | Required |
| Limitations and assumptions (versions, model assumptions) | Required | Required |
| Rails / Ruby angle | Built in | Required (at least one section) |
| FAQ (visible) | 5–7 Q&As | 3–5 Q&As |
| Links to related posts and the hub | Required | When relevant |
| Original word count (excluding the widget) | ~700–1,200 | ~400–800 |

- **All original writing.** No copied documentation; Postgres or Sidekiq docs may be quoted briefly and
  cited. This matters for the replicated-content rule (§3.3).
- Voice: direct, precise, technical, non-salesy (`PRODUCT.md`).

### 14.5 Images and social cards

- A share card per tool in the DESIGN.md "Share Cards" style, generated by `scripts/generate-tool-og.mjs`
  (modelled on `generate-post-og.mjs`).

### 14.6 Internal link rules

- Every live tool links to at least one post or hub, and is linked from at least the hub and its group
  (or the menu).
- No orphan tools.

### 14.7 Measurement

- Search Console: a baseline export in Phase 0, then monthly exports.
- Track three groups of queries: signature-tool queries, utility queries, and the existing article
  queries. **Watch whether article queries drop as utilities grow** (the dilution signal, §16 gates).

### 14.8 SEO regression check (required in every phase)

`scripts/seo-regression.mjs` builds the site and, for every **protected URL** (all URLs in the sitemap at
the start of the phase, minus any change the owner has approved):

- confirms the URL still exists with the same path
- compares `<title>`, meta description, canonical, robots meta, OG and Twitter tags and the full JSON-LD
  against a baseline snapshot (`.seo-baseline/baseline.json`, committed in Phase 0)
- compares the H1 and the list of heading IDs (anchors)
- for blog posts, confirms the sitemap URL and `lastmod` are unchanged

**Exit rule:** no unapproved differences. Approved changes are recorded in §17 and the baseline is
refreshed in the same commit.

**Usage (built in Phase 0, commit `607422d`):**
- `npm run seo:check` builds the site, then compares it against the baseline. Exit 0 means clean; exit 1
  lists every changed field with its before and after values.
- `npm run seo:baseline` rebuilds the snapshot. Use it only for approved changes.
- New URLs are reported with `+` but don't fail the check. They become protected the next time the
  baseline is refreshed.
- **Verified:** two consecutive builds produce identical snapshots, and a changed `<title>` is detected.
- **Refresh rule:** the baseline was taken at `f9a3e87`, which is `main` with the redesign merged. If
  `main` changes for reasons unrelated to tools (e.g. new posts), refresh the baseline on top of it and
  note that in §17.

---

## 15. Future AdSense strategy

**Status: not active. No ad scripts in any phase until the Phase 3 gate is approved** (§1 rule 14).

### 15.1 Gate conditions (Phase 3 review)

All of these must be true:
1. Utility pages bring in meaningful traffic, provisionally **≥ 30–50k pageviews a month** [A, the owner
   sets the final number].
2. Article and signature rankings are stable or rising. No dilution signal (§14.7).
3. Consulting leads from tools are not falling.
4. The owner explicitly approves, recorded in §17.

### 15.2 Rules by page type

| Page type | Ads | Rules |
|---|---|---|
| Utility tool pages with `adsEligible: true` | Allowed | Only inside the written content below the tool (How it works, Example, FAQ). **Never inside the tool surface**, never between input and result, never within ~150px of Run / Copy / Share / Download / file-select controls [A]. Space reserved (CLS). No vignettes or anchors on `/tools/*` |
| Signature tool pages | **Never** | High-intent visitors go to consulting |
| Articles | Optional (owner decides at the gate) | After the intro, mid-article, before the FAQ. Never inside code blocks, tables or diagrams |
| Homepage, hub, group pages, services, about, contact, projects, privacy, terms, 404 | **Never** | Navigation and trust pages |
| Result, processing or error states | **Never** | Google's "screens without content" and behavioural-screen rules |

### 15.3 How ads would be set up

- Manual ad units, or Auto ads with **page exclusions for everything except `adsEligible` utilities** and
  excluded areas around tool surfaces.
- Vignettes turned off on tool routes.
- Ad loading would be a separate component on its own branch, controlled per page by `adsEligible`.

### 15.4 Requirements before applying

- [ ] Privacy policy rewritten: third-party vendor cookies, personalized ads, opt-out links
      (answer/1348695), the consent tool, and an updated "Cookies" section (it currently says no tracking
      cookies).
- [ ] `/terms/` page.
- [ ] `public/ads.txt` with the AdSense publisher ID.
- [ ] A Google-certified consent tool for EEA, UK and Switzerland visitors (AdSense "Privacy & messaging"
      qualifies).
- [ ] US state privacy settings reviewed (restricted data processing).
- [ ] `PRODUCT.md` principle 4 amended to explain the ad policy and keep "no dark patterns".
- [ ] CSP updated for Google ad domains, on eligible pages only.
- [ ] Performance budgets re-checked with ads (CLS ≤ 0.1 at the 75th percentile).

### 15.5 Alternatives to evaluate at the gate

- Developer-focused, privacy-respecting ad networks (e.g. EthicalAds, Carbon). Their terms are
  **unverified**.
- Newsletter sponsorships.
- Keeping utilities ad-free if leads are worth more.

---

## 16. Phased roadmap (Phase 0 – Phase 4)

Timings assume part-time work [A]. **Each phase ends with owner review and approval before the next
starts.**

### Phase 0: Prep (week 0)

**Scope**
1. Owner approves the redesign. Merge `feat/premium-redesign` → `main`. **The merge and the push each need
   explicit permission.**
2. Export a Search Console baseline: last 3–6 months of queries, pages, clicks, impressions and position.
3. Check the demand and competition estimates in §6 for the Wave 1–2 tools (Keyword Planner and Search
   Console); update §6.
4. Create the SEO baseline snapshot for every current URL (`scripts/seo-regression.mjs --baseline`).
   This is the first code in the project, on `chore/seo-baseline`.
5. Settle the open decisions in §19 that block Phase 1 (D1–D4).
6. **Site-wide security hardening** (§11). Each item is a separate branch and commit.

| ID | Task | Who | Branch |
|---|---|---|---|
| S0-1 | Infrastructure and account items I-1 to I-10 (§11.8) | **Owner** (checklist supplied) | — |
| S0-2 | `scripts/security-check.mjs` (build and live modes) + npm scripts | Claude | `chore/security-check` |
| S0-3 | Fix the 12 `npm audit` advisories (`npm audit fix`, no major upgrades), then pin direct dependencies to exact versions. Followed by a full build, `seo:check` and a manual check of the site | Claude | `fix/deps-audit` |
| S0-4 | Site-wide headers in `public/_headers` + `scripts/csp-hashes.mjs`. CSP as **Report-Only** first, then enforcing. HSTS at stage 1 (§11.4 rollout) | Claude, deploy with explicit permission | `feat/security-headers` |
| S0-5 | CI workflow (§11.7) | Claude | `chore/ci` |
| S0-6 | Dependabot with cooldown (§11.7) | Claude | `chore/ci` |
| S0-7 | `jsonLd()` escaping helper; migrate every JSON-LD `set:html`. The output must be byte-identical for current content (`seo:check` clean) | Claude | `fix/jsonld-escaping` |
| S0-8 | Branch protection and signed commits (after D12 and D13) | **Owner** | — |

| | |
|---|---|
| Dependencies | Owner availability, Search Console access, Cloudflare and GitHub admin access for S0-1 and S0-8 |
| Risks | **HSTS `includeSubDomains`/`preload` is hard to undo** (staged rollout, D10); a strict CSP could break inline scripts or the newsletter form (Report-Only first); dependency fixes could change the build output (`seo:check` and a manual check); branch protection could block the agreed push flow (D12) |
| Testing | Baseline snapshot generated; the build passes on `main`; `security:check` passes in build and live modes; the CSP shows no console violations on the page checklist (home, post with diagrams, topic, tools, calculator, about, services, contact, 404) in both themes |
| Exit criteria | Redesign on `main` · Search Console baseline saved · §6 Wave 1–2 ratings checked · SEO baseline committed · D1–D4 decided · **S0-2 to S0-7 merged · `security:live` passes with all headers live (CSP enforcing, HSTS at stage 2 or later) · owner confirms S0-1 and S0-8 done or scheduled** |
| Deliverables | Baseline data (kept out of git if it's private), updated §6, `.seo-baseline/`, `security-check.mjs`, `csp-hashes.mjs`, `_headers`, CI + Dependabot, a clean `npm audit`, decisions in §17 |

### Phase 1: Foundation and first five tools (weeks 1–6)

**Scope**
1. `feat/tools-foundation`:
   - the `tools` collection
   - `tool-groups.ts`
   - `[slug].astro` with its build assertions
   - `ToolLayout`
   - `components/tools/*`
   - `_shared/*` with tests
   - the hub rewrite (same URL)
   - the Tools dropdown and mobile accordion
   - tool-route CSP additions (`worker-src`) on top of the site-wide policy from S0-4
   - `security:check` covering the new files
   - the test script
   - `generate-tool-og.mjs`
2. One branch per tool, in the order of §8: `feat/tool-postgres-lock-modes` → `feat/tool-sidekiq-retry-calculator`
   → `feat/tool-job-queue-capacity-calculator` → `feat/tool-cron-expression-explainer` →
   `feat/tool-postgres-deadlock-analyzer`.
3. Content: the written content for all five; a privacy page update (approval needed); article callouts
   (approval needed for each post); a "Tools for this topic" block on topic hubs; the homepage tools strip.

| | |
|---|---|
| Dependencies | Phase 0 complete, including the S0 security tasks; the §17 decision on the test runner |
| Risks | Version-specific formulas wrong (check the sources); deadlock log variants (add fixtures); DST bugs in cron (fixtures); header dropdown breaking the redesign (manual QA); scope creep (rule 3: only these five) |
| Testing | Unit tests and fixtures for every module; build assertions; the §10.8 checklist for each tool; SEO regression clean |
| Exit criteria | All five tools meet the Definition of Done · hub, menu and chaining work · SEO regression clean · `security:check` and `security:live` pass · Lighthouse budgets met · owner sign-off |
| Deliverables | 5 live tools, the shared architecture, updated hub and navigation, callouts, the updated privacy page, §0 and §6 status updated |

### Phase 2: Signature depth and first utilities (weeks 7–12)

**Scope**
- Signature: #3 backoff, #4 Sidekiq planner, #10 pool calculator v2 (migrated to the layout, **same URL**),
  #11 safe migrations, #12 timeouts, #17 Puma.
- Utilities: #24 JSON, #28 JWT, #34 timestamp, #35 UUID/ULID.
- Group pages appear automatically as groups reach 3 tools (`jobs`, `postgres`, `time`).

| | |
|---|---|
| Dependencies | Phase 1 approved |
| Risks | Migrating the pool calculator changes its page (needs regression approval for intended changes); the migration checker's Ruby parsing is fragile (scope it to patterns and state its limits); utility pages thin (enforce §14.4) |
| Testing | As Phase 1. The pool calculator v1 outputs must match v2 for the same inputs (regression fixtures) |
| Exit criteria | DoD for all 10 · SEO regression clean (approved diffs recorded) · **month-3 review done:** clicks per page, signature vs utility queries, tool → services evidence |
| Deliverables | 10 tools, group pages, the month-3 review report appended to this document (§20.D) |

### Phase 3: AI, Rails runtime and the utilities batch (months 4–6)

**Scope**
- `ai-backend` topic hub goes live (needs about 3 posts, which is a content dependency). Tools #21 and #22.
- Signature: #13, #14, #18, #19, #5, #6.
- Utilities: #25, #26, #29, #37, #38, #41, #42.
- **Month-6 gate:** the AdSense decision (§15.1) and the decision to keep adding utilities or stop.

| | |
|---|---|
| Dependencies | Phase 2 approved; AI posts written |
| Risks | **LLM prices go stale** (monthly maintenance task, a `lastVerified` date per model); EXPLAIN viewer effort (L); regex ReDoS (worker + timeout); lazy-library sizes (YAML, SQL formatter) |
| Testing | As before. The pricing data file has a test that fails if `lastVerified` is older than 45 days, as a reminder |
| Exit criteria | DoD for all · SEO regression clean · gate decisions recorded in §17 |
| Deliverables | 15 tools, the AI hub, the gate decision. If ads are approved: a separate `feat/ads-utilities` branch following §15 |

### Phase 4: Long tail (months 7–12)

**Scope**
- The remaining Wave 4 tools, **ranked by real Search Console data**. Tools rated SEO = L are optional and
  dropped if the data says so.
- ⌘K palette.
- Pagefind if needed.
- Upgrades: JWT RS256 verification; ruby.wasm for the regex tester, if it's justified.

| | |
|---|---|
| Dependencies | Phase 3 approved |
| Risks | Maintenance load (§18 A10); dilution; diminishing returns |
| Testing | As before |
| Exit criteria | Yearly review: keep, improve or drop each tool, based on data |
| Deliverables | Up to 17 tools, the yearly review |

**Pace rule:** at most about 2 tools a week, each with its full written content and tests.

---

## 17. Decision log

| ID | Date | Decision | By |
|---|---|---|---|
| DEC-01 | 2026-11-26 | Hybrid hub under `danialasghar.com/tools/`. No subdomain or separate domain for developer tools | Owner (approved) |
| DEC-02 | 2026-11-26 | No consumer tools (PDF, image, general text) on this domain. If they are ever built, they go on a separate domain | Owner (approved) |
| DEC-03 | 2026-11-26 | 47-tool roadmap and wave plan approved | Owner (approved) |
| DEC-04 | 2026-11-26 | First five: #9 lock modes, #1 retry calculator, #2 queue capacity, #33 cron, #8 deadlock analyzer | Owner (approved with roadmap) |
| DEC-05 | 2026-11-26 | Architecture: `tools` content collection + one `[slug].astro` route + `ToolLayout` + `src/tools/<slug>/` | Owner (approved with roadmap) |
| DEC-06 | 2026-11-26 | Ads never on signature, navigation or trust pages; no ad scripts until the Phase 3 gate | Owner (approved) |
| DEC-07 | 2026-11-26 | Goal order: leads → organic traffic → AdSense (limited to low-intent pages) | Owner (approved) |
| DEC-08 | 2026-11-26 | All tools run in the browser; share state only in the URL `#hash`; recents store slugs only | Proposed in roadmap |
| DEC-09 | 2026-11-26 | Flat tool URLs; the group is never part of the URL; group pages only with 3+ live tools | Proposed in roadmap |
| DEC-10 | 2026-11-26 | No UI framework; `node:test` with type stripping; no new dependency unless a check fails | Proposed in roadmap |
| DEC-11 | 2026-11-26 | No "Writing" dropdown; the topic sub-bar stays; "Tools" becomes a disclosure-button dropdown | Proposed in roadmap |
| DEC-12 | 2026-11-26 | Blog frontmatter schema untouched; links between tools and posts live in tool frontmatter | Proposed in roadmap |

| DEC-13 | 2026-11-26 | CSP and security headers go in the existing `public/_headers` file. The live site applies it (verified: `/_astro/*` serves `cache-control: public, max-age=31536000, immutable`), so A7 is resolved | Verified in Phase 0 |
| DEC-14 | 2026-11-26 | SEO baseline: `.seo-baseline/baseline.json` (25 URLs) taken from `feat/premium-redesign` at `f9a3e87` with `scripts/seo-regression.mjs`; no new dependencies | Phase 0 (`607422d`) |
| DEC-15 | 2026-11-26 | Tools work happens in a separate git worktree, because another session edits the main checkout at the same time. Only files named explicitly are added to commits | Process |

| DEC-16 | 2026-11-26 | **Standing push permission:** finished, verified branches may be merged or fast-forwarded into `main` and pushed, then local `main` updated. Force pushes, history rewrites, branch deletion, unfinished work and first-time HSTS changes still need explicit permission | Owner |
| DEC-17 | 2026-11-26 | Security scope is site-wide (blog, tools, build pipeline, infrastructure). Rules 20–26 added; §11.0 and §11.4–§11.10 added | Owner (requested) |
| DEC-18 | 2026-11-26 | Security headers on `/*` through `public/_headers`. CSP `script-src` uses SHA-256 hashes generated after the build (`scripts/csp-hashes.mjs`); no `'unsafe-inline'`/`'unsafe-eval'` for scripts; `style-src 'unsafe-inline'` accepted for now | Proposed (S0-4) |
| DEC-19 | 2026-11-26 | HSTS is rolled out in stages (300 s → 1 week → 2 years + preload). Submitting to the preload list needs owner approval (D10) | Proposed |
| DEC-20 | 2026-11-26 | Supply chain: `npm ci` with the lockfile, exact versions, `npm audit --audit-level=high` gate, Dependabot with a 7-day cooldown (3 days for security), actions pinned to SHAs | Proposed (S0-3/5/6) |
| DEC-21 | 2026-11-26 | Banned: `eval`, `new Function`, `innerHTML`-family APIs, `document.write`. `set:html` only on the §11.6 allowlist; JSON-LD goes through an escaping `jsonLd()` helper. Enforced by `security:check` | Proposed (S0-2/7) |

*Add a row for each new decision: test runner, analytics method, the ads gate, library choices with their
licences.*

---

## 18. Assumptions register

| ID | Assumption | How and when to verify |
|---|---|---|
| A1 | Demand and competition ratings in §6 are estimates | Keyword Planner + Search Console in Phase 0 (Wave 1–2), Phase 2 review (the rest) |
| A2 | Sidekiq retry formula `count**4 + 15 + rand(10)*(count+1)` and the dead-set defaults | Read `job_retry.rb` at each pinned version in Phase 1 |
| A3 | Active Job `:polynomially_longer` formula and defaults | Read the Rails source for 7.1–8.x in Phase 1 |
| A4 | The Postgres lock conflict matrix and the operation → lock mapping (Appendix A) | Check against the docs for each supported major version in Phase 1 |
| A5 | Deadlock DETAIL formats listed in §8.3 cover Postgres 13–17 | Check `deadlock.c` messages and real logs in Phase 1 |
| A6 | Node 22.12 `--experimental-strip-types` runs the test suite with a glob | Try it in Phase 1 (DEC-10) |
| A7 | ~~Cloudflare Workers static assets honour `public/_headers`~~ **Verified 2026-11-26** (DEC-13) | Done |
| A8 | Astro 7 supports `reference()` and `.refine()` in collection schemas | Check in Phase 1 |
| A9 | Cloudflare Web Analytics has no custom events | Check in Phase 1 (affects §13.6) |
| A10 | A sustainable pace is about 2 tools a week, with content | Review at the month-3 check |
| A11 | Ad revenue for developer audiences is low and ad blocking is high | Only real AdSense data can answer this, after the gate |
| A12 | Being covered for a subdomain once the root domain is approved by AdSense (only relevant if that option is ever revisited) | AdSense Sites documentation, only if needed |
| A13 | Library sizes and licences (YAML, `sql-formatter`) | Check at selection time in Phase 3 |
| A14 | FAQ rich results are limited to certain sites; the markup is still worth keeping | Not blocking |
| A15 | Cloudflare `_headers` merges a `/*` rule with more specific rules (`/_astro/*` Cache-Control) instead of replacing them | S0-4: check with `security:live` |
| A16 | One CSP header holding every inline-script hash stays within Cloudflare's header size limits | S0-4: `csp-hashes.mjs` measures it and fails the build if too large |
| A17 | Whether Astro 7 has built-in CSP hash support (and whether it can be used alongside `_headers`) | S0-4: read the Astro 7 docs and config types |
| A18 | The Cloudflare build uses `npm ci` (not `npm install`) | S0-5: check the Workers Builds settings (owner) |
| A19 | Dependabot supports a `cooldown` setting for npm | S0-6: GitHub docs |
| A20 | `npm ci --ignore-scripts` followed by an explicit rebuild works for `sharp`/`esbuild` | S0-5: try it in CI |

---

## 19. Open decisions and blockers

| ID | Item | Blocks | Owner |
|---|---|---|---|
| D1 | ~~Redesign merge into `main`~~ **Resolved:** `main` and `origin/main` are at `f9a3e87`, which includes the redesign and this roadmap. Merged outside this session | — | Done |
| D2 | ~~Base branch for Phase 1~~ **Resolved:** `main` (`f9a3e87`). The SEO baseline was taken from this exact commit | — | Done |
| D3 | Supported versions: Sidekiq (6.x? 7.x, 8.x), Rails (7.1–8.x), Postgres (13–17?) | Phase 1 tool specs | Owner |
| D4 | Search Console access or exports for the baseline and the keyword check | Phase 0 exit | Owner |
| D5 | Lead measurement method: mailto subject tagging (recommended) vs referrer check | Phase 1 CTA wiring | Owner |
| D6 | Approval of body edits: article callouts (§13.2), the privacy "Developer tools" section (§11.2), the services "tools I use" block (§13.5), the homepage tools strip (§13.7) | Parts of Phase 1 | Owner |
| D7 | Whether the hub's title and meta description may change (currently "Developer Tools — Rails & Background Jobs") | Phase 1 hub rewrite | Owner |
| D8 | Licence for tool code if the repo is ever made public | Not blocking | Owner |
| D9 | Final AdSense traffic threshold | Phase 3 gate | Owner |
| D10 | HSTS preload submission (hard to undo; covers every subdomain). Recommendation: reach stage 3, then decide | S0-4 stage 4 | Owner |
| D11 | Analytics beacon SRI: (a) versioned URL + SRI, (b) documented exception, or (c) leave analytics off | Only if the beacon is turned on | Owner |
| D12 | Branch protection vs direct push to `main`: admin bypass with required CI checks (recommended, keeps DEC-16), or PRs required | S0-8 | Owner |
| D13 | Signed commits: set up an SSH signing key locally so agent commits can be signed, then require them | S0-8 | Owner |

**Repository state (do not disturb), updated 2026-11-26 in Phase 0:**
- `main` = `origin/main` = `feat/premium-redesign` = `f9a3e87`. The redesign and this roadmap
  (`3fcbe6b`) are merged.
- `chore/seo-baseline` at `607422d` (+ the roadmap tracking commit), branched from `f9a3e87`. Not pushed.
- Tools work happens in a separate worktree (DEC-15), not in the main checkout.
- Branch `backup/premium-redesign-before-split` at `0cc6ac8`.
- `stash@{0}` ("experimental-uncoordinated-redesign-edits", made on `main`).
- Untracked `docs/PROJECT_OVERVIEW.md` and `files/`.
- A linked worktree at `/Users/dev/orca/workspaces/danial-blog/afanc` (branch `msohaibshahid/afanc`).

---

## 20. Appendices

### Appendix A: Postgres table-level lock conflict matrix

Source: PostgreSQL docs, "Explicit Locking" (Table 13.2). Re-verify for each supported major version (A4).
✕ = the two modes conflict.

| Requested ↓ / Held → | AS | RS | RE | SUE | S | SRE | E | AE |
|---|---|---|---|---|---|---|---|---|
| ACCESS SHARE (AS) | | | | | | | | ✕ |
| ROW SHARE (RS) | | | | | | | ✕ | ✕ |
| ROW EXCLUSIVE (RE) | | | | | ✕ | ✕ | ✕ | ✕ |
| SHARE UPDATE EXCLUSIVE (SUE) | | | | ✕ | ✕ | ✕ | ✕ | ✕ |
| SHARE (S) | | | ✕ | ✕ | | ✕ | ✕ | ✕ |
| SHARE ROW EXCLUSIVE (SRE) | | | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ |
| EXCLUSIVE (E) | | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ |
| ACCESS EXCLUSIVE (AE) | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ | ✕ |

**Typical operations (to verify in Phase 1):**

| Mode | Operations |
|---|---|
| AS | `SELECT` |
| RS | `SELECT … FOR UPDATE/FOR NO KEY UPDATE/FOR SHARE/FOR KEY SHARE` |
| RE | `INSERT`, `UPDATE`, `DELETE`, `MERGE` |
| SUE | `VACUUM` (not FULL), `ANALYZE`, `CREATE INDEX CONCURRENTLY`, `REINDEX CONCURRENTLY`, `CREATE STATISTICS`, `ALTER TABLE VALIDATE CONSTRAINT`, some `ALTER TABLE SET` forms |
| S | `CREATE INDEX` (not concurrent) |
| SRE | `CREATE TRIGGER`, `ALTER TABLE ADD FOREIGN KEY` (on both tables) |
| E | `REFRESH MATERIALIZED VIEW CONCURRENTLY` |
| AE | `DROP TABLE`, `TRUNCATE`, `REINDEX`, `VACUUM FULL`, `CLUSTER`, `REFRESH MATERIALIZED VIEW`, most `ALTER TABLE` forms, `LOCK TABLE` (default mode) |

**Row-level lock conflicts:** `FOR UPDATE` conflicts with all four; `FOR NO KEY UPDATE` conflicts with
`FOR SHARE`, `FOR NO KEY UPDATE` and `FOR UPDATE`; `FOR SHARE` conflicts with `FOR NO KEY UPDATE` and
`FOR UPDATE`; `FOR KEY SHARE` conflicts only with `FOR UPDATE`.

### Appendix B: Formula reference

**Sidekiq default retries (A2)**
- delay(c) = c⁴ + 15 + rand(10)·(c+1), with c = 0, 1, 2, …
- 25 retries:
  - no jitter: 1,763,395 s
  - expected jitter: +1,462.5 s
  - max jitter: +2,925 s
- Σc⁴ for c = 0..n = n(n+1)(2n+1)(3n²+3n−1)/30.

**Erlang C (M/M/c)**
- a = λ/μ, ρ = a/c.
- Erlang B recurrence: B₀ = 1, Bₖ = a·Bₖ₋₁/(k + a·Bₖ₋₁).
- C = B_c / (1 − ρ(1 − B_c)).
- Wq = C/(cμ − λ).
- P(Wq > t) = C·e^(−(cμ−λ)t).

**Little's law:** L = λW.

### Appendix C: Proposed `package.json` script additions (Phase 1)

```json
{
  "scripts": {
    "test": "node --test --experimental-strip-types \"src/tools/**/*.test.ts\"",
    "seo:baseline": "node scripts/seo-regression.mjs --baseline",
    "seo:check": "node scripts/seo-regression.mjs",
    "og:tools": "node scripts/generate-tool-og.mjs"
  }
}
```

### Appendix D: Review reports

*Append the month-3, month-6 and yearly review reports here: date, Search Console figures, decisions
taken.*

### Appendix E: Sources

- iLovePDF and iLoveIMG pages fetched on 2026-11-26: `/`, `/merge_pdf`, `/compress_pdf`, `/pdf_to_word`,
  `/blog`, `/pricing`, `/help/security`, `/help/faq`, iloveimg.com, iloveapi.com/pricing.
- The AdSense, Publisher Policy, Search and Chrome sources are listed with their URLs in §3.3.
- Postgres "Explicit Locking": https://www.postgresql.org/docs/current/explicit-locking.html
- Sidekiq `lib/sidekiq/job_retry.rb`, and Rails `activejob/lib/active_job/exceptions.rb` (versions to be
  pinned in Phase 1).
- RFC 9562 (UUID v7), RFC 9309 (robots.txt), RFC 4180 (CSV).
