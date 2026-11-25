---
version: 1
slug: "src-pages-index-astro"
primary_target: "src/pages/index.astro"
related_targets: ["src/layouts/BlogPost.astro","src/pages/blog/index.astro","src/pages/services.astro"]
---

# Surface brief: site-wide redesign (home first, then every page)

Scope: homepage (Persuade), blog index, posts, topic hubs (Read), services (Persuade), tools/calculator (Operate), projects, about, contact, privacy, 404.
Audience/job: Rails engineers mid-incident who need the fix and the mechanism; leads deciding whether to hire Danial. Action: read, then contact via /services/.
Constraints: content, URLs, JSON-LD and SEO preserved; light and dark complete; WCAG AA; no invented proof.

## Direction contract

THESIS: A developer publication in the Honeybadger / Medium / Ruby Weekly tradition, done at their craft level: the writing is the product, set big and confident. It refuses the current template's whisper (thin hairline rows, eyebrows, a lone headline over empty space) and the SaaS landing page alike.

OWN-WORLD: White page, near-black ink, one ruby (#B8123A light / #FF6F8E dark) for the a of the brand mark, links and the primary action. Heavy grotesk display (Bricolage Grotesque 800, tight tracking) for titles; Medium-style serif reading text (Charter/Charis SIL, 20px); JetBrains Mono only for code. Components: topic sub-bar under the header, post entries as big bold title + dek + byline row with a DA avatar, a sticky right rail ("On this page", one bordered work-with-me card). Square-ish corners (6px), no shadows except the sticky header.

STORY: The visitor sees an expert publication on Rails reliability, finds the article they need in one scan, reads it comfortably, and meets one calm route to hire Danial beside the text.

FIRST VIEWPORT: Brand lockup left (the "da" ligature mark, ink d + ruby a, beside "Danial Asghar" in Bricolage 800; amended 2026-11-26 because the owner asked for a unique logo of his own rather than a Ruby Weekly-style red block), nav right with Services as an outlined ruby button; topic sub-bar; H1 "Reliability engineering for Rails and AI backends." at ~4rem with a one-line lede; below, the newest post as the first big feed entry on the left, the right rail holding the work-with-me card. Primary action: the first article title; secondary: Services.

FORM: canon (the standing exit, chosen by the user's reference to Ruby Weekly, Medium and Honeybadger); seed:c56c1fcc023395ce.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
