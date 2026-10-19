# Cloudflare WAF custom rules — danialasghar.com

Deploy under **Security → WAF → Custom rules**. Rules run in list order, so put the
Block rule first.

The expressions below work on the **Free plan**. Two common variants do not:
`cf.client.bot_management.verified_bot` needs the Enterprise Bot Management
add-on, and the regex `matches` operator needs Business or higher. Both are
replaced here with `cf.client.bot` and `ends_with()`.

This is a static Astro site. It serves no PHP, WordPress, `.env` or `.git`
paths, so every request matching Rule 1 comes from a scanner.

---

## Rule 1: block scanner and exploit probe paths

**Action:** Block

```
(http.request.uri.path contains "/wp-")
or (http.request.uri.path contains "wp-config")
or (http.request.uri.path contains "/xmlrpc.php")
or (http.request.uri.path contains ".env")
or (http.request.uri.path contains ".bak")
or (http.request.uri.path contains ".sql")
or (http.request.uri.path contains ".old")
or (http.request.uri.path contains "/.git")
or (http.request.uri.path contains "/.aws")
or (http.request.uri.path contains "/vendor/phpunit")
or (ends_with(lower(http.request.uri.path), ".php"))
or (ends_with(lower(http.request.uri.path), ".asp"))
or (ends_with(lower(http.request.uri.path), ".aspx"))
or (ends_with(lower(http.request.uri.path), ".jsp"))
```

Before adding a new page or post, check that its slug doesn't contain any of these
substrings (for example a post slug with `.env` or `.old` in it).

---

## Rule 2: Managed Challenge for hosting ASNs probing sensitive paths

**Action:** Managed Challenge. Don't use Block here; see the caution below.

```
(not cf.client.bot)
and (ip.src.asnum in {14061 16509 14618 16276 24940 45102})
and (
  http.request.uri.path contains "wp"
  or http.request.uri.path contains ".env"
  or http.request.uri.path contains ".git"
  or http.request.uri.path contains "config"
)
```

ASNs: 14061 DigitalOcean · 16509 / 14618 Amazon · 16276 OVH · 24940 Hetzner ·
45102 Alibaba. These are examples; tune the list to what shows up in your
Security → Events.

**Caution:** these networks also carry legitimate traffic (corporate VPNs, CI and
preview bots, some readers). That's why the rule:

1. uses **Managed Challenge** instead of Block, so humans pass,
2. skips known good bots (`cf.client.bot`: Googlebot, Bingbot, …),
3. only fires on suspicious paths, so a reader on a cloud IP browsing `/blog` is
   never challenged.

Don't turn this into a blanket ASN block. You'd lose real readers.

---

## Also enable

- **Bot Fight Mode** (Security → Bots). Free, needs no rule.
- **404 rate limiting** (optional): challenge an IP that gets more than about 30
  404 responses in a minute. This catches path-fuzzing scanners that Rule 1
  doesn't list. Counting by response status and choosing the time window need a
  paid plan. Free-plan rate limiting can only count requests per IP over 10
  seconds, so check what your plan allows before relying on this.

---

## Verify after deploying

Watch **Security → Events** for a day:

- Rule 1 should start catching the wp/.env/.git probes immediately.
- Rule 2 must not challenge normal `/blog`, `/tools` or `/services` traffic. If it
  does, narrow the path conditions or drop an ASN.

Cloudflare and most analytics already exclude known bots from reported traffic.
Expect the gains to show up as cleaner logs and a smaller attack surface, not as a
change in GSC or analytics numbers.
