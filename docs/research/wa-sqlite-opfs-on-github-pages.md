# Research: Does wa-sqlite OPFS work on GitHub Pages?

**Ticket:** #53 (part of #51 wayfinder map)
**Date:** 2026-09-03
**Verdict: OPFS works on GitHub Pages as-is — no code or VFS change required.**

## TL;DR

None of the wa-sqlite OPFS VFSes (including the `OriginPrivateFileSystemVFS` this app actually uses) require cross-origin isolation, SharedArrayBuffer, or any custom HTTP headers. GitHub Pages' constraint that it cannot set custom response headers is therefore irrelevant to the storage layer. The two requirements that *do* exist — HTTPS secure context and a dedicated Web Worker — are both already satisfied. Proof by existence: the wa-sqlite author's own demo, running every OPFS VFS, is hosted on GitHub Pages (`rhashimoto.github.io`) and serves no COOP/COEP headers.

## What the app actually uses

`frontend/package.json` pins `wa-sqlite: ^1.0.0` (the only version ever published to npm — a frozen snapshot from Jan 2024, not the author's current repo).

`frontend/src/db/worker.ts`:

- Loads `wa-sqlite/dist/wa-sqlite-async.mjs` (the Asyncify-based async build) and `wa-sqlite-async.wasm`.
- Registers **`OriginPrivateFileSystemVFS`** from `wa-sqlite/src/examples/` as the default VFS — *not* `AccessHandlePoolVFS` or `OPFSCoopSyncVFS` as the ticket hypothesized (those aren't even in the npm 1.0.0 snapshot).
- Runs inside a dedicated module worker (`frontend/src/db/init.ts:10`: `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`).
- Opens `music-catalogue.db` directly in the OPFS root.

What `OriginPrivateFileSystemVFS` requires (verified in `node_modules/wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js`):

| Requirement | API | GitHub Pages OK? |
|---|---|---|
| Secure context | `navigator.storage.getDirectory()` (OPFS) | ✅ Pages enforces HTTPS |
| Dedicated worker | `FileSystemFileHandle.createSyncAccessHandle()` — exposed in dedicated workers only | ✅ already runs in a dedicated worker |
| Locking | Web Locks API (`WebLocksExclusive`) | ✅ no headers involved |
| Nothing else | No `SharedArrayBuffer`, no `Atomics`, no COOP/COEP anywhere in the VFS source or the async wasm build (grep-verified in `node_modules/wa-sqlite`) | ✅ |

## The COOP/COEP confusion, untangled

The ticket's worry is understandable — it comes from the **official** SQLite WASM build (`sqlite.org`), a different project:

- The official build's `"opfs"` VFS requires SharedArrayBuffer + Atomics, hence COOP/COEP headers; its `"opfs-sahpool"` VFS does not. Confirmed on the SQLite forum: *"There are two different OPFS VFSes. That warning applies to the 'opfs' VFS, not to the 'opfs-sahpool' VFS."* (https://www3.sqlite.org/cgi/forum/info/3b7ca2d0221e0a2a3010b83b1d4d80c6529b782089c3658e56859ef6cc4231d0)
- **wa-sqlite deliberately takes the other path.** rhashimoto (wa-sqlite author): AccessHandlePoolVFS *"uses OPFS for storage without Asyncify or Atomics/SharedArrayBuffer"* (https://github.com/rhashimoto/wa-sqlite/issues/35), and the multi-tab service demos work *"without the COOP/COEP headers or performance penalties of Atomics/SharedArrayBuffer"* (https://github.com/rhashimoto/wa-sqlite/discussions/84).

**OPFS itself never needed headers.** Per MDN, OPFS *"doesn't require the same series of security checks and permission grants"* — the only gate is a secure context (https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system). COOP/COEP is only needed by *implementations that choose to use SharedArrayBuffer*. wa-sqlite doesn't.

**Existence proof:** the wa-sqlite demo at `https://rhashimoto.github.io/wa-sqlite/demo/` runs `AccessHandlePoolVFS`, `OPFSCoopSyncVFS`, and friends **on GitHub Pages**. Verified 2026-09-03 via `curl -I`:

```
HTTP/2 200
content-type: text/html; charset=utf-8
(no Cross-Origin-* headers)
```

and `https://rhashimoto.github.io/wa-sqlite/dist/wa-sqlite-async.wasm` returns `content-type: application/wasm` — so Pages also serves wasm with the correct MIME type (streaming compilation works).

GitHub Pages' no-custom-headers limitation is longstanding: community feature request open since 2021, still unimplemented (https://github.com/orgs/community/discussions/13309). Header configuration exists only for GitHub Enterprise Server admins, not github.com Pages (https://docs.github.com/en/enterprise-server/admin/configuring-settings/configuring-user-applications-for-your-enterprise/configuring-github-pages-for-your-enterprise). We don't need it.

## Browser support floor (host-independent)

`OriginPrivateFileSystemVFS` uses the modern access-handle spec (`read`/`write` with `{at: offset}`, synchronous `flush()`/`getSize()`), so the effective browser floor — same as `AccessHandlePoolVFS`, per rhashimoto — is **Chrome/Edge 108+, Safari 16.4+, Firefox 111+** (https://github.com/rhashimoto/wa-sqlite/issues/35; https://developer.chrome.com/blog/sync-methods-for-accesshandles; Safari 16.4 release notes: "Made all FileSystemSyncAccessHandle methods synchronous").

**Safari quirks worth knowing:**

- Safari 15.2–16.3 shipped `createSyncAccessHandle()` but spec-misaligned (sync methods arrived in 16.4); on older Safari the `{at: n}` option is not honoured, which would silently mis-position SQLite's random reads. Same risk self-hosted or on Pages — not a Pages issue, but it argues for a browser-support floor / feature check at startup.
- Safari 16.4 also *"Fixed FileSystemSyncAccessHandle write operation to be quota protected"* (https://developer.apple.com/documentation/safari-release-notes/safari-16_4-release-notes) — writes before 16.4 could exceed quota unchecked.
- Safari proactively evicts best-effort origin storage for sites the user hasn't interacted with in ~7 days (Safari 13.1+/iOS 13.4+), and Safari is the only browser that prompts when quota is exceeded (https://web.dev/articles/storage-for-the-web).
- Chromium on macOS/iOS flushes OPFS writes via `F_FULLFSYNC` and is >10x slower on OPFS flush transactions than Safari/Firefox on the same Apple hardware — a durability-vs-speed trade-off baked into browsers, not hosting (https://github.com/rhashimoto/wa-sqlite/discussions/84).

## Behaviour differences vs the current self-hosted setup

The storage layer's behaviour is a function of **browser + origin**, not of HTTP headers or host. What actually changes on Pages:

1. **The origin changes — and that means the data changes.** OPFS (and IndexedDB) are partitioned per origin. If the app currently lives at a different origin (own domain/host), users' existing OPFS databases will *not* follow; the Pages deployment starts with an empty OPFS. If a custom domain is ever added later, the same applies again in reverse.
2. **`*.github.io` is a shared origin.** For `https://<user>.github.io/<repo>/`, the origin is the whole `https://<user>.github.io` — all of that user's Pages projects share one OPFS and one IndexedDB namespace. `music-catalogue.db` sits in the flat OPFS root and could theoretically collide with a file of the same name from another project under the same account. Mitigation if ever needed: prefix the filename per-project (e.g. `music-catalogue/music-catalogue.db` — the VFS handles subdirectories) or move to a custom domain.
3. **Eviction/persistence policy: unchanged.** OPFS counts against origin quota, is best-effort by default, and is only protected via `navigator.storage.persist()` — identical rules self-hosted or on Pages (https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). Worth calling `navigator.storage.persist()` regardless of host; Chrome research shows auto-eviction is rare, and the app should already be handling private-browsing quirks (deleted at session end, reduced quota).
4. **Worker, wasm, MIME: unchanged.** Pages serves `.js`/`.mjs` as `text/javascript` and `.wasm` as `application/wasm`; module workers work as-is.

## If it had been blocked: nearest alternatives

Not needed for this VFS, but for the record (all ship in the same `wa-sqlite` examples directory, none need headers either):

- **`IDBBatchAtomicVFS`** — IndexedDB with batch-atomic writes; the featured IndexedDB VFS in upstream benchmarks. Slower I/O than OPFS but works everywhere IndexedDB does, including shared workers.
- **`MemoryVFS`/`MemoryAsyncVFS` + manual persistence** — fastest reads, but the whole DB must fit in memory and you own durability; more code, strictly worse than IDBBatchAtomicVFS for this use case.
- Upstream-only VFSes not in the npm 1.0.0 snapshot (`OPFSCoopSyncVFS`, `OPFSAdaptiveVFS`, `OPFSWriteAheadVFS`, `IDBMirrorVFS`) would require vendoring the repo or switching to a package that tracks upstream.

## Sharp questions surfaced

1. **Origin strategy:** is `https://<user>.github.io` (shared with all that user's other Pages repos) acceptable for production, or should this deploy under a custom domain? Both the shared-OPFS collision risk and future data-migration pain hang on this.
2. **Data continuity:** the move from the current self-hosted origin to Pages (and any later custom domain) silently orphans users' local DBs — is a one-time export/import expected?
3. **npm staleness:** `wa-sqlite@1.0.0` on npm is a frozen Jan-2024 snapshot; upstream has ~5 years of fixes and newer, better-tested OPFS VFSes. Should we vendor the upstream repo or migrate to `OPFSCoopSyncVFS`?
4. **`OriginPrivateFileSystemVFS` is an "example" VFS** (the examples README: "Using them as-is in production is not prohibited but that isn't their primary purpose") and it holds a write-mode access handle for the life of an exclusive lock — multi-tab write contention should be tested before shipping, independent of hosting.
5. **Adjacent, out of scope:** GitHub Pages has no SPA routing fallback — deep links under react-router will 404 on refresh unless a 404.html copy trick or hash routing is used. Relevant to the same deploy effort.

## Sources

- wa-sqlite issue #35 (author on OPFS without SAB/COOP-COEP, browser floors): https://github.com/rhashimoto/wa-sqlite/issues/35
- wa-sqlite discussion #84 (OPFS demos without COOP/COEP; Chromium/macOS flush performance): https://github.com/rhashimoto/wa-sqlite/discussions/84
- wa-sqlite demo hosted on GitHub Pages: https://rhashimoto.github.io/wa-sqlite/demo/
- MDN — Origin private file system: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system
- MDN — `createSyncAccessHandle()` (dedicated-worker-only, secure context): https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle
- MDN — Storage quotas and eviction: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- Chrome Developers — sync methods for access handles (Chromium 108): https://developer.chrome.com/blog/sync-methods-for-accesshandles
- Safari 16.4 release notes: https://developer.apple.com/documentation/safari-release-notes/safari-16_4-release-notes
- WebKit blog — File System API with OPFS: https://webkit.org/blog/12257/the-file-system-access-api-with-origin-private-file-system/
- SQLite forum — official wasm `opfs` VFS needs COOP/COEP, `opfs-sahpool` doesn't: https://www3.sqlite.org/cgi/forum/info/3b7ca2d0221e0a2a3010b83b1d4d80c6529b782089c3658e56859ef6cc4231d0
- GitHub community — Allow setting COOP/COEP headers in GitHub Pages (open since 2021): https://github.com/orgs/community/discussions/13309
- web.dev — Storage for the web / Persistent storage: https://web.dev/articles/storage-for-the-web, https://web.dev/articles/persistent-storage
- Local code: `frontend/src/db/worker.ts`, `frontend/src/db/init.ts`, `frontend/node_modules/wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js`
