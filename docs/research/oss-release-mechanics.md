# Research: OSS release mechanics (tags, Releases, Actions)

- **Ticket**: PepsiiMan/music-catalogue#55 (part of wayfinder map #51)
- **Date**: 2026-09-03
- **Scope**: Mechanical side only — versioning, tags, GitHub Releases with generated notes, Actions CI/CD, deploy-on-tag hook for GitHub Pages. Not the hosting decision (#57) or OPFS-on-Pages (#53), though both surface here (see Sharp questions).

## TL;DR

**Use `googleapis/release-please-action@v5` with `release-type: simple` (single repo version, tag `vX.Y.Z`), and put the GitHub Pages deploy as a second job in the same workflow, gated on the action's `release_created` output.** This mimics how real OSS projects release (Release PR → merge → tag + Release + CHANGELOG), needs **zero secrets** (no PAT, no PAGES_TOKEN), and survives GitHub's GITHUB_TOKEN anti-recursion rule. Changesets is not a fit; a plain `git tag` + `gh release create --generate-notes` is the zero-tooling fallback but loses changelog/version automation.

## Verified tooling state (September 2026)

Checked against primary sources on 2026-09-03:

| Tool | Current version | Notes |
| --- | --- | --- |
| `googleapis/release-please-action` | **v5.0.0** (2026-04-22) | v5 upgraded the action to Node 24 runtime (Node 20 deprecated on GH Actions March 2026). README examples still show `@v4`; pin `@v5`. |
| `@changesets/cli` | **3.0.1** (2026-08-19) | Changesets **v3** announced 2026-08-11: all packages ESM-only, require Node `^22.11 \|\| ^24 \|\| >=26`. |
| `actions/checkout` | **v7.0.1** (2026-07-20) | |
| `actions/setup-node` | **v7.0.0** (2026-07-14) | |
| `actions/upload-pages-artifact` | **v5.0.0** (2026-04-10) | |
| `actions/deploy-pages` | **v5.0.1** (2026-09-01) | README examples still show `@v4`; v5 is current. |
| `gh release create --generate-notes` | current gh CLI | Calls the GitHub Release Notes API (lists merged PRs + contributors). |

Sources: [release-please-action releases](https://github.com/googleapis/release-please-action/releases), [release-please-action v5.0.0](https://github.com/googleapis/release-please-action/releases/tag/v5.0.0), [node24 upgrade issue](https://github.com/googleapis/release-please-action/issues/1188), [Announcing Changesets v3](https://changesets.dev/blog/announcing-changesets-v3), [@changesets/cli on npm](https://www.npmjs.com/package/@changesets/cli), [actions/deploy-pages releases](https://github.com/actions/deploy-pages/releases), [gh_release_create manual](https://cli.github.com/manual/gh_release_create). Action versions fetched live from the GitHub API.

## Option analysis

### 1. release-please (recommended)

How it works: parses conventional commits (`fix:` → patch, `feat:` → minor, `feat!:`/`BREAKING CHANGE:` → major) and maintains a **Release PR** ("chore(main): release 1.2.3"). Merging the Release PR bumps the version, updates `CHANGELOG.md`, pushes the git tag, and creates the GitHub Release with notes extracted from the changelog. ([release-please-action README](https://github.com/googleapis/release-please-action))

Fit for this repo:

- **Commit history already conforms.** Recent commits are `fix:`, `feat:`, `refactor:` conventional style — release-please consumes exactly this.
- **Nothing is published to npm** (frontend/ and backend/ are `private: true`), so release-please's version-of-record is the git tag + `CHANGELOG.md` at repo root, not any `package.json`.
- `release-type: simple` is designed for "a repository with a version.txt and a CHANGELOG.md" — no framework assumptions, no root `package.json` needed. It maintains root `version.txt` + `CHANGELOG.md` and tags `vX.Y.Z`.
- Solo-dev cost: review + merge one PR per release. Everything else is automatic.

### 2. changesets (not a fit)

How it works: each PR includes a human-written changeset Markdown file (intent + semver bump type); a bot-accumulated "Version Packages" PR aggregates them; `changesets version` bumps **per-package** versions; `changesets publish` (via `changesets/action`) publishes to npm. ([Announcing Changesets v3](https://changesets.dev/blog/announcing-changesets-v3), [@changesets/cli](https://www.npmjs.com/package/@changesets/cli))

Why not here:

- Its whole model is **per-package versioning for npm-published monorepos**. This repo deploys one app and publishes nothing to npm.
- GitHub Releases are second-class in changesets: you get them only by wiring `changesets/action` with a custom publish script (or a third-party changelog config) — more moving parts for less fidelity than release-please's built-in GitHub Release step.
- Per-PR changeset files are ceremony for a solo dev; release-please derives the same information from commit messages you already write.
- Fresh major (v3, three weeks old as of this research) — fine, but no incentive to adopt it for this shape of repo.

### 3. Plain git tag + `gh release create --generate-notes` (acceptable fallback)

```sh
git tag -a v1.0.0 -m "v1.0.0" && git push origin v1.0.0
gh release create v1.0.0 --generate-notes
```

`--generate-notes` calls GitHub's Release Notes API: a list of merged PRs, contributor avatars, and a full-changelog link, customisable via `.github/release.yml` (categories by label, excludes). ([gh_release_create](https://cli.github.com/manual/gh_release_create), [Automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes))

- Pro: zero dependencies, zero config.
- Con: no `CHANGELOG.md` in-repo, version bookkeeping is entirely in your head, and generated notes only cover **merged PRs** — direct pushes to main (which this repo does) don't appear. release-please's notes come from conventional **commits**, matching this repo's actual history better.

**Verdict**: release-please. It is the "how real OSS projects do it" option (it is what Google, many large orgs, and thousands of repos run), and its cost model — write conventional commits, merge a release PR — is lower than changesets' for a solo dev, and far lower than hand-tagging once you want a maintained changelog.

## Single repo version vs per-package versioning

**Single repo version** (one `vX.Y.Z` tag for the whole app). Rationale:

- frontend + backend + the Python detector ship as **one app**, always released together; per-package versions would be bookkeeping with no consumer.
- Nothing goes to npm, so per-package versions have no downstream semver consumers.
- Per-package versioning (changesets, or release-please manifest config with `frontend`/`backend` entries) adds config files and decisions for no benefit. If the repo ever publishes packages, release-please's manifest config ([manifest-releaser doc](https://github.com/googleapis/release-please/blob/master/docs/manifest-releaser.md)) is the upgrade path — same tool, same workflow, just a `release-please-config.json`.

Keep `frontend/package.json` and `backend/package.json` `private: true` with dummy versions; the tag is the version of record.

## The critical gotcha: GITHUB_TOKEN doesn't trigger workflows

If release-please (or anything) creates a tag/Release using the default `GITHUB_TOKEN`, **no other workflow is triggered** — GitHub suppresses workflow-from-workflow runs to prevent recursion. The release-please-action README warns about this explicitly and suggests a PAT. ([README → "Other Actions on Release Please PRs"](https://github.com/googleapis/release-please-action#other-actions-on-release-please-prs), [GitHub docs: triggering a workflow from a workflow](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow), [googleapis/release-please#1142](https://github.com/googleapis/release-please/issues/1142))

This bites the obvious design — `deploy.yml` with `on: push: tags` or `on: release: [published]` — when release-please creates the tag with `GITHUB_TOKEN`.

**The clean escape for a solo dev: run the deploy job in the same workflow, gated on the action's outputs** (`release_created`, `tag_name`). Same-run job chaining is not subject to the recursion guard, so **no PAT and no secret rotation is needed**. (A PAT — fine-grained, `contents: write` — remains the documented option if you ever want CI to run *on* the release PR itself or want decoupled workflow files; for solo-dev-on-main, CI on regular pushes covers it.)

## Deploy-on-tag for GitHub Pages

Modern official flow — **OIDC, no PAT, no `PAGES_TOKEN`** (the old third-party `peaceiris/actions-gh-pages` + token pattern is superseded):

1. Repo **Settings → Pages → Source: "GitHub Actions"** (one-time UI setting; nothing deploys without it).
2. Build job runs the frontend build, uploads `frontend/dist` via `actions/upload-pages-artifact@v5`.
3. Deploy job calls `actions/deploy-pages@v5` with job-level `permissions: pages: write, id-token: write` and the `github-pages` environment. The `id-token` permission mints a per-job OIDC JWT that Pages uses to verify the deployment origin (and to honour branch protection). ([actions/deploy-pages README](https://github.com/actions/deploy-pages))

Note on old-style `PAGES_TOKEN`/PAT deploys: not needed at all in this design; adding one would be strictly more secret surface.

## Recommended workflow (concrete sketch)

One file: `.github/workflows/release.yml`.

```yaml
name: release

on:
  push:
    branches: [main]

permissions:
  contents: write
  issues: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    outputs:
      release_created: ${{ steps.rp.outputs.release_created }}
      tag_name: ${{ steps.rp.outputs.tag_name }}
    steps:
      - id: rp
        uses: googleapis/release-please-action@v5
        with:
          release-type: simple
          # First release only: force v1.0.0 instead of the 0.1.0 default.
          # Remove this line after v1.0.0 is out.
          release-as: 1.0.0

  deploy-pages:
    needs: release-please
    if: needs.release-please.outputs.release_created == 'true'
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
        working-directory: frontend
      - run: npm run build
        working-directory: frontend
      - uses: actions/upload-pages-artifact@v5
        with:
          path: frontend/dist
      - id: deployment
        uses: actions/deploy-pages@v5
```

One-time setup: Settings → Pages → Source: **GitHub Actions**; Settings → Actions → General → allow GitHub Actions to create and approve pull requests (needed for the Release PR).

Backend/PY-service: no release mechanics needed — they're deployed as one app via docker-compose/Caddy today. The `vX.Y.Z` tag is the trigger point if a backend deploy hook is ever wanted (another job here, or a GHCR image build gated on the same outputs).

## What a v1.0.0 release looks like end-to-end

1. **Setup commit**: merge `release.yml` (with `release-as: 1.0.0`) + flip Pages source to "GitHub Actions".
2. **Trigger**: next push to `main` containing conventional commits since the bootstrap (e.g. the recent `feat:`/`fix:` history).
3. **Release PR**: release-please opens **"chore(main): release 1.0.0"** — adds root `CHANGELOG.md` (feat/fix sections with commit links) and `version.txt` (`1.0.0`). It keeps itself updated as more commits land.
4. **You merge the Release PR.** That single merge is the whole "release button".
5. **Same workflow run**:
   - release-please job: pushes tag `v1.0.0`, creates the GitHub Release **"1.0.0"** with the changelog entry as notes body, outputs `release_created=true`, `tag_name=v1.0.0`.
   - `deploy-pages` job (gated `if`): builds `frontend/`, uploads the artifact, deploys to Pages → site serves the released build at the Pages URL.
6. **Net result, ~1 minute after the merge**: `git tag v1.0.0` → GitHub Release with notes → `CHANGELOG.md` at HEAD → live Pages deployment. No secrets, no CLI incantations.
7. Subsequent releases: drop `release-as`, repeat steps 2–6; versions advance by conventional-commit rules (0.x caveats don't apply since you're ≥1.0.0).

## Sharp questions surfaced

1. **Vite `base` for project Pages.** `frontend/vite.config.ts` sets no `base`; on project pages (`https://<user>.github.io/music-catalogue/`) assets 404 unless `base: '/music-catalogue/'` (or an env-driven base) is set before the first deploy. A custom domain removes the subpath. Blocks the first Pages deploy, not the release mechanics.
2. **COOP/COEP on Pages.** The dev server sets `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy` headers (vite.config.ts:12-15); GitHub Pages can't set response headers, so anything depending on them (e.g. SharedArrayBuffer for wa-sqlite OPFS, ticket #53) behaves differently in prod. Interacts with hosting decision #57.
3. **Does the backend get a deploy-on-tag hook at all?** Currently self-hosted via docker-compose/Caddy. Decide whether a tag also builds/pushes a GHCR image (trivial extra job in the same workflow) or remains manual (hosting #57).
4. **Version stamping in the UI.** Do you want the running version visible (about box / footer)? If yes, add a tiny build step that reads `version.txt` into `import.meta.env`; do it before v1.0.0 to avoid churn.
5. **CI on the Release PR?** With `GITHUB_TOKEN` the Release PR itself won't trigger CI. Direct-to-main solo flow makes this moot (CI can run on push to main); if you ever want it, the documented escape is a fine-grained PAT as `token:` on the release-please step.

## Sources

- [googleapis/release-please-action README](https://github.com/googleapis/release-please-action) — inputs (`release-type`, `release-as`, `include-component-in-tag`), outputs (`release_created`, `tag_name`), GITHUB_TOKEN warning, release types incl. `simple`.
- [release-please-action releases](https://github.com/googleapis/release-please-action/releases) / [v5.0.0](https://github.com/googleapis/release-please-action/releases/tag/v5.0.0) / [node24 upgrade #1188](https://github.com/googleapis/release-please-action/issues/1188) — v5.0.0, 2026-04-22, Node 24 runtime.
- [release-please manifest-releaser doc](https://github.com/googleapis/release-please/blob/master/docs/manifest-releaser.md) — bootstrap, default initial version (0.1.0 for node), `release-as`, `initial-version`, `include-component-in-tag`.
- [googleapis/release-please#1142](https://github.com/googleapis/release-please/issues/1142) — tag created by the action doesn't trigger downstream workflows.
- [GitHub docs: Triggering a workflow from a workflow](https://docs.github.com/en/actions/using-workflows/triggering-a-workflow) — GITHUB_TOKEN events don't create workflow runs (except `workflow_dispatch`/`repository_dispatch`).
- [Announcing Changesets v3](https://changesets.dev/blog/announcing-changesets-v3) + [@changesets/cli npm](https://www.npmjs.com/package/@changesets/cli) — v3.0.1, 2026-08-19, ESM-only, Node ^22.11||^24||>=26.
- [actions/deploy-pages README](https://github.com/actions/deploy-pages) — build/upload/deploy job split, `pages: write` + `id-token: write`, OIDC rationale.
- [gh_release_create manual](https://cli.github.com/manual/gh_release_create) — `--generate-notes`, `--notes-start-tag`, `--verify-tag`.
- [GitHub docs: Automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes) — `.github/release.yml` config, PR-based generation.
- Action versions (checkout v7.0.1, setup-node v7.0.0, upload-pages-artifact v5.0.0, deploy-pages v5.0.1) fetched from the GitHub Releases API on 2026-09-03.
