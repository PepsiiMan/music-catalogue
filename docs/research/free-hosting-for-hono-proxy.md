# Research: Best free managed host for a Hono proxy (fallback)

**Ticket:** #54 (part of #51 wayfinder map) · **Date:** 2026-09-03 · **Status:** Resolved — recommendation: **Cloudflare Workers (free plan)**, runner-up Vercel Hobby

## Question

Only relevant if the proxy survives research ticket #52 ("Can the browser talk to MusicBrainz + Cover Art Archive directly?"). If the browser can't call upstream APIs directly, which free tier best hosts the Hono backend in `backend/`?

Workload shape (verified in code): thin outbound proxy — `backend/src/musicbrainz/client.ts` and `backend/src/coverartarchive/client.ts` make 1 upstream fetch per request, return JSON, no DB, no auth, no websockets. Search responses are small JSON. Node.js >= 22, Hono 4.x on `@hono/node-server`, app factory pattern (`createApp()` returns a `.fetch`-compatible Hono app). Already has a 1 rps token-bucket limiter and a configurable `User-Agent`.

All limits below verified against official docs in September 2026.

## Comparison (free tiers, 2026)

| Criterion | Cloudflare Workers (Free) | Vercel (Hobby) | Render (Free web service) | Koyeb (Free instance) |
|---|---|---|---|---|
| Request limit | **100,000/day** (~3M/mo); over → HTTP 1027 | 1M function invocations/month | 750 instance-hours/workspace/month (one always-on service ≈ 744h, so exactly one service) | 1 free instance per org |
| Cold starts | **None** (V8 isolates; 1s startup budget) | Serverless cold starts exist; fluid compute keeps instances warm across requests | **~1 minute** spin-up after 15 min idle, with loading page | Scales to zero after **1 hour** idle (cannot disable); cold start ~1–5s |
| CPU / memory | 10 ms CPU per invocation (I/O wait **not** counted); 128 MB | 4 active-CPU-hours + 360 GB-hrs provisioned memory per month; 2 GB max; 300s max duration | 0.1 vCPU, 512 MB | 0.1 vCPU, 512 MB, 2 GB disk |
| Subrequests / egress | 50 external subrequests per invocation; 6 simultaneous outbound connections; **no charge for outbound fetches** | No subrequest cap that bites; egress billed only on paid plans | Outbound bandwidth drawn from workspace monthly pool; no card → suspension if exceeded | No documented cap that bites at this scale |
| Custom domain (free) | **Yes** (Custom Domains; domain's DNS must be on a Cloudflare zone — free plan OK) + `workers.dev` subdomain | Yes, 50 domains/project | Yes, with managed TLS | Yes |
| CI deploy from GitHub Actions | `cloudflare/wrangler-action`; secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`; wrangler config in repo | Native Git integration is idiomatic; GH Actions documented with `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` | Deploy hook URL as a repo secret (`curl "$RENDER_DEPLOY_HOOK_URL"`) or native auto-deploy on push | Native GitHub auto-deploy, or `koyeb/action-git-deploy` with `KOYEB_API_TOKEN` |
| Runtime match | **Hono's native platform** — the app is already a fetch handler; port is ~a config file + entry export | Zero code change (Node runtime) | Zero code change (Node) | Zero code change (Node/buildpack) |
| Catch for this workload | Shared egress IPs vs MusicBrainz per-IP throttle (see below); 10 ms CPU caps future heavy transforms | Hobby is **personal, non-commercial use only**; cold starts on interactive search | Cold start kills interactive search UX; free services can restart at any time | Docs say free instance "should not be used for production"; single region (Frankfurt or Washington DC) |

## Also considered

- **Deno Deploy (free):** 1M requests/month, 20 GB egress, 15 CPU-hours, 5 custom domains; Hono runs natively on Deno and `deployctl` has a GH Action. Solid, but requires moving off the Node runtime for no gain over Workers here; over-quota orgs are paused until the next cycle.
- **Google Cloud Run (always-free):** 2M requests/month + 180k vCPU-s + 360k GiB-s, scale-to-zero with container cold starts, 60-min timeouts. Capable, but heaviest ops burden of the set (container build/push, gcloud tooling, service-account/WIF setup for Actions). Not worth it for a no-DB proxy.
- **Fly.io, Railway, Heroku:** no meaningful perpetual free tier in 2026 (Fly removed free allowances; Railway is a one-time trial credit; Heroku dropped free in 2022). Eliminated.

## Recommendation

**Cloudflare Workers, free plan.** It is Hono's home platform — the backend's app factory already returns a fetch-compatible handler, so the port is a `wrangler.jsonc` plus re-exporting `createApp().fetch` (the Node `main.ts` stays for local dev). The free plan's limits (100k req/day, 50 subrequests, 6 concurrent outbound connections, 10 ms CPU with I/O wait excluded) are all sized for a personal thin proxy with large headroom, there are no cold starts, custom domains and TLS are free, and CI deploy is one official Action with two secrets.

**Runner-up: Vercel Hobby** — zero code change, same class of limits, but its non-commercial clause and function cold starts make it the fallback-of-the-fallback. **Avoid Render Free for this workload**: the ~1-minute cold start after 15 idle minutes lands directly on interactive search UX. Koyeb works but its own docs discourage production use of the free instance.

### Port constraints on Workers (the honest list)

1. **MusicBrainz throttles by source IP** (~1 rps average; exceed it and *all* requests from that IP get 503 until the rate drops). Workers egress IPs are shared with other tenants, so we can inherit throttling we didn't cause. Mitigations, in order: keep the distinctive `User-Agent` (MusicBrainz asks for contactable UAs before blocking), keep the 1 rps client limiter, cache MB responses (Workers Cache API), and honor `Retry-After` on 503s. Note this risk is much smaller on Render/Koyeb/Cloud Run NAT pools and zero in the browser-direct future (#52) — it's the strongest argument *for* browser-direct.
2. **10 ms CPU per invocation** — fine for fetch-passthrough JSON (~1–5 ms), but a hard ceiling if the proxy ever does heavy transforms (zip parsing, bulk matching on the server). Keep the proxy thin; the import/match CPU work stays client-side.
3. **`RateLimiter` uses `setInterval`** (backend/src/musicbrainz/client.ts:6) — carries over to workerd only as module-global state; rework it (or lean on Cache API) as part of the port.
4. **Custom domain requires the domain's DNS zone on Cloudflare** (free). If the frontend lands on GitHub Pages with its own domain, pick DNS placement once, deliberately.
5. 50-subrequest and 6-connection limits are non-issues at 1–2 upstream calls per request, but worth knowing if handlers fan out (e.g. N cover-art lookups in one request).

## Sources

- Cloudflare Workers limits & pricing (requests/day, CPU, subrequests, 2026-02 subrequest changelog): https://developers.cloudflare.com/workers/platform/limits/ · https://developers.cloudflare.com/workers/platform/pricing/ · https://developers.cloudflare.com/changelog/post/2026-02-11-subrequests-limit/
- Cloudflare Workers Custom Domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- Vercel Hobby plan, Functions limits, fluid-compute pricing, GH Actions guide: https://vercel.com/docs/plans/hobby · https://vercel.com/docs/functions/limitations · https://vercel.com/docs/functions/usage-and-pricing · https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel
- Render free docs, pricing, deploy hooks: https://render.com/docs/free · https://render.com/pricing · https://render.com/docs/deploy-hooks
- Koyeb instance reference, scale-to-zero, deploy action: https://www.koyeb.com/docs/reference/instances · https://www.koyeb.com/docs/run-and-scale/scale-to-zero · https://github.com/koyeb/action-git-deploy
- Deno Deploy pricing: https://deno.com/deploy/pricing
- Google Cloud Run pricing (always-free tier): https://cloud.google.com/run/pricing
- MusicBrainz API rate limiting (per-IP rule, User-Agent policy): https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
