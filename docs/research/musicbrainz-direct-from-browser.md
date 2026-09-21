# Research: Can the browser talk to MusicBrainz + Cover Art Archive directly?

Resolves [#52](https://github.com/PepsiiMan/music-catalogue/issues/52) (part of the wayfinder map #51).
Researched 2026-09-03. All header claims were verified live from this machine on that date.

## Verdict

**Direct-from-browser is viable for the core features (release search + cover art).** Both
`musicbrainz.org/ws/2` and `coverartarchive.org` send `Access-Control-Allow-Origin: *` on every
hop (including the Internet Archive hosts CAA redirects to), no API key is required, and
MusicBrainz' per-IP rate limit actually works *in favour of* a browser-direct architecture:
each visitor's own IP gets its own 1 req/s budget instead of all visitors sharing the proxy's
single IP. The proxy is **not** required for search + cover art; it *is* still the (a) home of
the `/api/import` album-detector proxy and (b) the only place that can set a proper
MusicBrainz User-Agent, so dropping the backend has two real costs — neither fatal.

## Evidence

### 1. CORS: both APIs are open to browsers (verified live, 2026-09-03)

MusicBrainz API v2 (`https://musicbrainz.org/ws/2`):

```
GET /ws/2/release/?query=...&fmt=json
  → HTTP/2 200
    access-control-allow-origin: *

OPTIONS /ws/2/release/  (preflight)
  → HTTP/2 200
    allow: GET, POST, OPTIONS
    access-control-allow-methods: GET, POST, OPTIONS
    access-control-allow-headers: Authorization, Content-Type, User-Agent
    access-control-allow-origin: *
```

A plain search `GET` needs no preflight at all, and `ACAO: *` admits any origin. CORS on MB has
been deliberately enabled for years (confirmed on the forums: *"MusicBrainz does already allow
all CORS requests… `Access-Control-Allow-Origin: "*`"* —
[community.metabrainz.org/t/does-musicbrainz-api-support-jsonp/26144](https://community.metabrainz.org/t/does-musicbrainz-api-support-jsonp/26144)).
It is not documented on the API page as a "feature", but it is server behaviour we verified
ourselves and that third parties rely on.

Cover Art Archive (`https://coverartarchive.org`) — tested with a real release MBID
(`833e71cd-989e-44db-ae40-1a3898358e91`), following the full redirect chain with an `Origin`
header set:

```
GET coverartarchive.org/release/{mbid}/front
  → HTTP/2 307
    location: https://archive.org/download/mbid-.../mbid-...-12517012167.jpg
    access-control-allow-origin: *

GET archive.org/download/...            (hop 2)
  → HTTP/2 302
    location: https://dn710908.ca.archive.org/0/items/...jpg
    access-control-allow-origin: *

GET dn710908.ca.archive.org/0/items/... (final image host)
  → HTTP/2 200
    access-control-allow-origin: *
    access-control-allow-credentials: true
```

Even CAA's JSON metadata endpoints and its 400-error responses carry `ACAO: *`. The final image
host is an Internet Archive node, not MB-controlled, but it currently serves `ACAO: *` — which
matters because our frontend already loads art with `<img crossOrigin="anonymous">`
(`frontend/src/components/AlbumCard.tsx:44`, `SearchCard.tsx:72`), i.e. in CORS mode. Today it
loads those images from archive.org **directly** (the proxy only resolves the redirect);
that part of the architecture is already browser-direct.

Note: CAA docs say redirects are `307` ([CAA API doc](https://musicbrainz.org/doc/Cover_Art_Archive/API));
live behaviour matches (the backend accepts both 302 and 307, `backend/src/coverartarchive/client.ts:20`).

### 2. User-Agent policy: browsers can't set UA, and there is no official browser-app scheme

- UA is a **forbidden header name** in the Fetch spec — browser JS cannot override it, so every
  request goes out with e.g. `Mozilla/5.0 …`. No workaround exists; this is a browser guarantee.
- MusicBrainz requires *"a meaningful user-agent string"* in lieu of an API key
  ([MusicBrainz API doc, rev 79405](https://musicbrainz.org/doc/MusicBrainz_API),
  General FAQ). The recommended shape is `App name/<version> (contact-url|email)`.
- The [Rate Limiting doc, rev 78895](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
  maintains a blocklist of "anonymous" UAs that get throttled: **blank**, `Java`, `Python-urllib`,
  `Jakarta Commons-HttpClient`, `Apache-HttpClient (UNAVAILABLE)`. **Browser UAs are not on the
  list**, so browser-originated requests pass the UA check today — they just carry no contact
  info for MB to reach maintainers if the app misbehaves (*"there needs to be enough information
  in the User-Agent string for us to contact the maintainers"*).
- There is **no documented alternative** for browser clients: no Origin-header convention, no
  `client=` parameter for GETs (`client=` exists only for POST submissions, API doc §Submitting
  data). A July 2026 forum thread asked MetaBrainz exactly our three questions (client-side
  CORS use acceptable? browser UA a problem?); the only reply was from a non-staff member
  saying client-device direct requests are fine
  ([community.metabrainz.org/t/musicbrainz-terms-of-service-for-client-side-ajax-website/815229](https://community.metabrainz.org/t/musicbrainz-terms-of-service-for-client-side-ajax-website/815229)).
  No staff position exists yet.
- So browser use is **de-facto sanctioned** (CORS `*` is deliberately on; many client-side apps
  exist; the throttle is designed around many small clients per IP) but **under-identified**:
  MB can't contact the app's maintainers from the UA alone. The app's identity *is* implicitly
  visible via the `Origin`/`Referer` headers browsers send automatically — just not in a
  documented scheme.

### 3. Rate limiting: per-IP — which favours browser-direct

From the [Rate Limiting doc](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting) (rev
78895, "rules as of 2012-01-08", still the canonical page): each request is checked in order —
(1) User-Agent, (2) **source IP**, (3) global. Per-IP rule: *"The rate at which your IP address
is making requests is measured… Currently that rate is (on average) 1 request per second"* — and
if exceeded, **all** requests from that IP get 503 until the rate drops. Global allowance is
300 req/s. No API key / per-app token exists, so "per-app" throttling only happens reactively
against misbehaving UA strings.

Implications for this app:

- **Proxy (current)**: every visitor shares one proxy IP. The app-wide effective budget is
  ~1 req/s regardless of user count. This is exactly what `RateLimiter(1000)` in
  `backend/src/musicbrainz/client.ts:46` models — the proxy had to invent a global 1 rps ceiling
  *because* its own architecture funnels everyone through one IP. Bursts beyond that queue/503;
  sustained abuse risk is an IP block affecting all users.
- **Browser-direct**: each visitor spends their *own* IP's 1 req/s. One human doing occasional
  searches is nowhere near it; total capacity scales with visitors. This matches how MB designed
  the throttle (they expect many small clients). Caveats: users behind shared NAT/VPN pools
  share a budget (still fine at human pace), and the frontend must pace *itself* (debounce +
  serialise searches ~1/s per client) because nothing else will.

Cover Art Archive: *"There are currently no rate limiting rules in place at coverartarchive.org"*
([CAA API doc, rev 77795](https://musicbrainz.org/doc/Cover_Art_Archive/API), §Rate limiting
rules) — no limit documented as of that revision; treat as "unchanged but re-verify before
release".

### 4. What `backend/src` actually adds — and what removal would cost

Read from the code (no caching exists anywhere in the backend — `backend/package.json` has no
cache deps and no cache middleware; the only caching is React Query on the frontend for
cover-art lookups):

| Concern | Where | Would be lost? |
|---|---|---|
| Global 1 rps token bucket | `musicbrainz/client.ts` `RateLimiter(1000)` | Yes — but it exists only to protect the shared proxy IP. Browser-direct doesn't need a *global* limiter; the frontend needs a *per-client* pacer instead. |
| 10 s upstream timeout (MB, CAA) | `client.ts` ×2, `AbortSignal.timeout` | No — reproducible in browser with `AbortSignal.timeout()`; frontend already treats failures as `null` (`api/search.ts:22`). |
| UA injection `name/version (contact)` | `config.ts:4` | **Yes, irrecoverably** — browsers can't set UA. Mitigations: rely on Origin/Referer identity; announce the app on the MB forum / contact MB per the rate-limit doc's advice; keep a `?app=` query param is *not* a documented scheme (don't invent one silently). |
| Lucene query building (`title:"x" AND artist:"y"`) | `musicbrainz/client.ts:54-62` | No — move to frontend (small pure function). Note: currently *no escaping* of embedded quotes; #45's "fuzzy default + sanitisation" work would just move to the frontend. |
| Response normalisation → `ReleaseDTO{mbid,title,artist,date}` | `musicbrainz/client.ts:75-87`, `models.ts` | No — move to frontend; it's ~15 lines. Frontend gains a dependency on raw MB JSON shape (already versioned, stable, `fmt=json`). |
| Drop releases without artist-credit | `musicbrainz/client.ts:77-78` | No — same, moves to frontend. |
| CAA redirect resolution (307 → final URL) | `coverartarchive/client.ts` (redirect: 'manual') | No — and actually better gone: the frontend can point `<img src>` straight at `coverartarchive.org/release/{mbid}/front` and let the image tag follow redirects; the `/search/coverart/:mbid/front` endpoint (and its round trip) disappears entirely. Verified the final host serves `ACAO: *` for `crossOrigin="anonymous"`. |
| Concurrency cap (5) + 30 s backlog → 429 | `middleware/throttle.ts` | Irrelevant — protects the proxy from its clients; no proxy, no surface. |
| 30 s route timeout, 1 MB request cap, gzip, logger, error handler | `app.ts`, `middleware/*` | Irrelevant / handled by browser and upstreams (browsers always send `Accept-Encoding: gzip`; MB responds gzipped). |
| `/api/import` album-detector proxy | `albumdetector/*` | **Out of scope of MB/CAA but the real blocker**: `POST /api/import/detect` forwards ≤30 MB multipart (300 s timeout) to a separate `album-detector` service (`ALBUM_DETECTOR_URL`, default `http://album-detector:8000`). That is a *second* server that can't run on GitHub Pages. Removing the Node backend strands bulk import; it needs its own decision (expose the detector directly, keep a tiny server, or drop import from the static build). |

### Risk summary for browser-direct

1. **Identification gap** — no way to send the contact-bearing UA MB asks for; browser UA is
   currently not throttled, but MB may block misbehaving "unidentifiable" traffic reactively.
   Low risk at 1 rps-per-visitor human usage; worth an explicit ask to MB before release.
2. **503 behaviour is all-or-nothing per IP** — one visitor hammering search can trip their own
   503s until they slow down (MB declines *everything* from that IP once over, it doesn't shed a
   percentage). Frontend needs debounced, serialised, user-visible-retry search.
3. **Third-party host dependency** — final art comes from `*.archive.org` nodes (ACAO `*`
   verified today, but outside MB's control); CAA "no rate limits" is doc-dated.
4. **Non-commercial** — MB API is free for non-commercial use with commercial plans available
   (API doc FAQ). Fine for an OSS release; keep it that way.

## Bottom line

A GitHub Pages static build can do search (`musicbrainz.org/ws/2/release/?query=…&fmt=json`)
and cover art (`coverartarchive.org/release/{mbid}/front` via `<img>`) with **no backend**,
provided the frontend (a) implements its own ~1 rps pacer + debounce, (b) absorbs the
normalisation/quoting logic, and (c) accepts browser-UA identification with Origin/Referer as
the app's contact identity. The remaining backend responsibility is the album-detector import
proxy, which is a separate hosting decision (#54/#57 territory).

## Sources

- Live header captures, 2026-09-03 (musicbrainz.org, coverartarchive.org, archive.org,
  dn710908.ca.archive.org) — commands and outputs quoted above.
- <https://musicbrainz.org/doc/MusicBrainz_API> (rev 79405) — no API key, meaningful UA required,
  1 call/s per client application, `client=` for POSTs only.
- <https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting> (rev 78895) — UA / per-IP / global
  checks, 1 req/s per IP, anonymous-UA blocklist, contactability requirement.
- <https://musicbrainz.org/doc/Cover_Art_Archive/API> (rev 77795) — endpoint shapes, 307
  redirects, "no rate limiting rules" as of that revision.
- <https://community.metabrainz.org/t/does-musicbrainz-api-support-jsonp/26144> — CORS `*` relied
  on by client-side apps since 2016.
- <https://community.metabrainz.org/t/musicbrainz-terms-of-service-for-client-side-ajax-website/815229>
  (July 2026) — identical question asked; no staff answer; non-staff confirmation that
  client-device direct use is fine.
- Local code: `backend/src/app.ts`, `backend/src/config.ts`, `backend/src/musicbrainz/*`,
  `backend/src/coverartarchive/*`, `backend/src/middleware/*`, `backend/src/albumdetector/*`,
  `frontend/src/api/search.ts`, `frontend/src/components/{AlbumCard,SearchCard}.tsx`.
