# Cloudflare WAF Custom Rules — danialasghar.com

Deploy under **Security → WAF → Custom rules**. Order matters: put Block rules first.

---

## Rule 1 — Block scanner/exploit probe paths (kills 404 noise)

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
or (lower(http.request.uri.path) matches "\\.(php|asp|aspx|jsp)$")
```

Why: you run Rails. None of these paths exist on your site, so every match is
hostile automation. Blocking them removes the 404s that pollute logs and
reduces attack surface (the WP/React RCE probes you captured all hit these).

---

## Rule 2 — Managed Challenge for suspicious hosting ASNs

**Action:** Managed Challenge  *(NOT Block — see caution)*

```
(not cf.client.bot_management.verified_bot)
and (
  ip.geoip.asnum in {14061 16509 14618 16276 24940 45102}
)
and (
  http.request.uri.path contains "wp"
  or http.request.uri.path contains ".env"
  or http.request.uri.path contains ".git"
  or http.request.uri.path contains "config"
)
```

ASN reference (tune to YOUR logs — these are examples of networks commonly
used for scanning): 14061 DigitalOcean · 16509 Amazon AWS · 14618 Amazon ·
16276 OVH · 24940 Hetzner · 45102 Alibaba.

**Caution:** these ASNs also carry legitimate traffic (corporate VPNs,
CI/preview bots, some users). That's why this rule:
  1. uses **Managed Challenge**, not Block (humans pass, bots don't),
  2. excludes `verified_bot` (lets Googlebot/Bingbot through),
  3. is **scoped to suspicious paths** so a normal visitor from a cloud IP
     browsing /blog is never challenged.
Do not turn this into a blanket ASN block — you'll lose real readers.

---

## Also enable (free tier, no rule needed)

- **Bot Fight Mode** (Security → Bots): catches the long tail of simple bots.
- **Rate limiting rule:** if one IP throws > 30 requests resulting in 404 within
  1 minute → Managed Challenge. Catches path-fuzzing scanners you didn't list.

---

## Verify before relying on it

After deploying, watch **Security → Events** for a day:
- Confirm Rule 1 is catching the wp/.env/.git probes (it will, immediately).
- Confirm Rule 2 is NOT challenging legitimate /blog or /tools traffic.
  If it is, tighten the path conditions or remove an ASN.

Note: Cloudflare and most analytics already exclude *known* bots from your
reported traffic, so the main wins here are **cleaner server logs** and a
**smaller attack surface**, not necessarily a change in GSC/analytics numbers.
