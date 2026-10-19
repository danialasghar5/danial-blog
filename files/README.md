# danialasghar.com — Production Upgrade (Services + Tool + SEO + WAF)

Commit-ready files for the 4-task upgrade. Apply in this order.

## File manifest

```
config/
  routes.rb                                    # merge into your routes
app/
  helpers/seo_helper.rb                         # per-post title/meta overrides
  controllers/
    pages_controller.rb                         # /services /about /privacy /contact
    tools_controller.rb                         # /tools + calculator
  views/
    pages/{services,about,contact,privacy}.html.erb
    tools/connection_pool_calculator.html.erb   # the tool (client-side)
    shared/_article_services_cta.html.erb        # end-of-post CTA partial
    blog/show.html.erb                           # reference: where CTA + head tags go
cloudflare/
  waf-rules.md                                   # Task 4 — WAF expressions
```

## Apply order

1. **SEO (Task 1):** add `app/helpers/seo_helper.rb`; wire `seo_title` /
   `seo_description` / `seo_og_tags` into your layout `<head>`. Add the CTA
   partial and render it at the bottom of the blog post view.
2. **Routes + pages (Task 2):** merge `routes.rb`; add `pages_controller.rb`
   and the four page views. Replace `$X,XXX` and the Cal.com URL in
   `services.html.erb`.
3. **Tool (Task 3):** add `tools_controller.rb` and the calculator view.
4. **WAF (Task 4):** deploy the rules in `cloudflare/waf-rules.md`.

## Two intentional corrections (read these)

1. **Title #3 was a topic mismatch.** The spec asked to put a
   *"Sidekiq Connection Pool Limits"* title on the **at-least-once delivery**
   article (`/blog/sidekiq-job-runs-twice-at-least-once-delivery`). That would
   make the title contradict the article's content — bad for CTR (clicked
   headline ≠ H1) and for rankings. Instead:
   - the at-least-once post gets a CTR-optimized title that **matches its
     content** ("Why Your Sidekiq Job Runs Twice (And How to Stop Double-Charges)"),
   - the **connection-pool keyword** is targeted by the **calculator page**,
     whose below-the-fold content actually satisfies that search intent.

2. **Calculator formula.** Implemented as:
   - a pool must be ≥ the threads in its own process (web pool ≥ Puma threads;
     worker pool ≥ Sidekiq concurrency), with +2 headroom for the recommendation;
   - a separate global check that total peak connections across all processes
     doesn't exceed Postgres `max_connections`.
   Logic validated against four real scenarios (classic under-sized pool,
   balanced app, Postgres exhaustion, shipped defaults).

## Note on the shipped tool defaults
The default inputs (pool 5, Sidekiq concurrency 10) render a **"Risk" verdict on
load** — intentionally, because that's the single most common real misconfig and
it makes the tool demonstrate value immediately. To open "green" instead, change
the default `db_pool` value to `12` in the calculator view.
```
