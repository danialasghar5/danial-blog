# app/helpers/seo_helper.rb
#
# Centralizes per-page SEO metadata so titles/descriptions can be overridden
# per blog post without touching each view. Set @seo in a controller action,
# OR rely on the SLUG_OVERRIDES map below for static posts.
#
# Usage in a layout <head>:
#   <title><%= seo_title %></title>
#   <meta name="description" content="<%= seo_description %>">
#   <%= seo_og_tags %>
#
module SeoHelper
  DEFAULT_TITLE       = "Danial Asghar — Backend Reliability Engineering for Rails"
  DEFAULT_DESCRIPTION = "Production Rails, PostgreSQL, and background-job reliability — " \
                        "deep engineering write-ups from a senior backend engineer."
  SITE_URL            = "https://danialasghar.com"

  # CTR-optimized overrides, keyed by blog slug.
  #
  # NOTE (intentional correction): the connection-pool title requested for the
  # at-least-once article was a topic mismatch and is NOT applied here. The
  # at-least-once post keeps a title that matches its real content; the
  # "connection pool limits" keyword is targeted by the calculator page
  # (/tools/connection-pool-calculator) where the content actually satisfies it.
  SLUG_OVERRIDES = {
    "solid-queue-vs-sidekiq" => {
      title: "Solid Queue vs Sidekiq (2026): The Real Decision Guide",
      description: "Not a feature table. When Solid Queue wins, when Sidekiq wins, " \
                   "and the one question that usually decides it — from a senior Rails engineer."
    },
    "sidekiq-retry-strategy-transient-vs-permanent-failures" => {
      title: "Sidekiq Retry & Backoff: Stop Retrying Jobs That Can't Succeed",
      description: "Transient vs permanent failures, exponential backoff with jitter, " \
                   "and the Dead Set — a production retry strategy."
    },
    # Matches the article's ACTUAL content (at-least-once delivery), CTR-optimized.
    "sidekiq-job-runs-twice-at-least-once-delivery" => {
      title: "Why Your Sidekiq Job Runs Twice (And How to Stop Double-Charges)",
      description: "At-least-once delivery, explained: the five windows where a job re-runs, " \
                   "why exactly-once is impossible, and where the fix actually lives."
    }
  }.freeze

  def seo_meta
    # @seo (set in a controller) wins; otherwise fall back to slug map; else defaults.
    override = @seo || SLUG_OVERRIDES[current_slug] || {}
    {
      title:       override[:title]       || DEFAULT_TITLE,
      description: override[:description] || DEFAULT_DESCRIPTION,
      url:         override[:url]         || request.original_url,
      image:       override[:image]       || "#{SITE_URL}/og/default.png"
    }
  end

  def seo_title       = seo_meta[:title]
  def seo_description = seo_meta[:description]

  def seo_og_tags
    m = seo_meta
    safe_join([
      tag.meta(property: "og:title", content: m[:title]),
      tag.meta(property: "og:description", content: m[:description]),
      tag.meta(property: "og:url", content: m[:url]),
      tag.meta(property: "og:image", content: m[:image]),
      tag.meta(property: "og:type", content: "article"),
      tag.meta(name: "twitter:card", content: "summary_large_image"),
      tag.meta(name: "twitter:title", content: m[:title]),
      tag.meta(name: "twitter:description", content: m[:description]),
      tag.link(rel: "canonical", href: m[:url])
    ], "\n")
  end

  private

  # Derive the current post slug from params (adjust to your routing).
  def current_slug
    params[:slug] || params[:id]
  end
end
