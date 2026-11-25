# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: working Rails engineers** (mid to senior) who land on an article from Google, Ruby Weekly or RubyFlow while debugging a production problem: Sidekiq jobs running twice, retry storms, slow queues, connection pool exhaustion, Postgres races and deadlocks. They read on a laptop at work, often with the failing system open in another window, and they copy code.
- **Secondary: engineering leads and founders** of production Rails teams who have a reliability problem in production and are deciding whether to hire outside help. They arrive through an article or the homepage and evaluate `/services/`.

## Product Purpose

danial-blog (danialasghar.com) is Danial Asghar's site: deep technical writing on reliability engineering for Rails and AI backends, backed by open-source code he builds. Success, in order *(inferred: user delegated the priority on 2026-11-26)*:

1. A reader gets a correct, complete answer to the problem that brought them, and trusts the source.
2. Some of those readers, or their leads, contact Danial for a fixed-scope consulting engagement through `/services/`.
3. Search visibility and reputation grow, so more of the right readers arrive.

## Positioning

Reliability writing grounded in production failure modes and real code: each article explains the mechanism (delivery vs execution, lock ordering, pool sizing) rather than offering opinions, and the consulting offers are the same topics delivered against a client's own system. A generic Rails blog or agency cannot truthfully claim that the writing and the service are the same body of work.

## Operating Context

- Readers arrive mid-search with a specific error or symptom, scan for the answer, then read the mechanism.
- Articles contain long code blocks, SQL, tables, diagrams, FAQs and cross-links between posts in a topic hub.
- `/tools/connection-pool-calculator/` is an interactive sizing tool used alongside the pool article.
- Consulting contact is by email (`hello@danialasghar.com`, via `BOOKING_URL` mailto); there is no scheduler.

## Capabilities and Constraints

- Astro static site (MDX content collections), deployed to Cloudflare Workers static assets. No server runtime, no logins.
- Pages: home, blog index, posts, topic hubs (Background Jobs, Database Reliability live; AI Backend not live), services, tools index and connection pool calculator, projects and case studies, about, contact, privacy, 404, RSS.
- SEO is a hard constraint: semantic headings, JSON-LD (TechArticle, FAQPage, BreadcrumbList), trailing-slash internal links, titles ≤60 chars, fast static pages. Visual changes must not break these.
- Light and dark themes with a toggle; both must be complete.
- Content, URLs, frontmatter schema and functionality are preserved in any redesign.

## Brand Commitments

- Name: **Danial Asghar**. Role line: Senior Backend Engineer. Positioning line: "Reliability engineering for Rails and AI backends."
- Voice: direct, precise, technical, non-salesy ("If I can help, I'll say how; if I can't, I'll point you to who can.").
- No specific colour, typeface or logo mark is binding *(user gave creative freedom on 2026-11-26)*.
- Standing preference (2026-11-26, user's words): "I want design referenced as rubyweekly/medium/honeybadger type of blogs design." The site follows the established developer-publication convention at those products' craft level, not an experimental world.

## Evidence on Hand

- The articles themselves, their diagrams (`src/components/diagram/`) and code.
- Open-source projects and case studies in `src/content/projects/` (AI Lead Engine, AI Support Ticket Triage Engine, CovetPics, Interstride).
- Features in Ruby Weekly and RubyFlow; Google rankings #1–6 for Sidekiq/Solid Queue reliability terms (positions drift; keep the claim generic).
- Service prices: $1,000 / $2,000 / $3,000 starting prices.
- **Absent, never fabricate:** testimonials, client logos, headshot photo, traffic or uptime metrics (`src/data/metrics.ts` is intentionally empty).

## Product Principles

1. The answer comes first: a reader with an error message finds the fix and the mechanism without fighting the page.
2. Proof over claims: credibility comes from the depth of the writing and real code, never from invented numbers or badges.
3. Writing and consulting are one body of work; the path from an article to `/services/` is natural and never pushy.
4. Long-term trust beats short-term clicks: no dark patterns, no popups, no hype.

## Accessibility & Inclusion

WCAG 2.2 AA in both themes, including syntax-highlighted code. Code and tables must stay readable and copyable on phones.
