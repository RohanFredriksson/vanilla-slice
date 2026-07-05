# ADR 0008 — Versioning and publishing strategy

Status: Accepted · Date: 2026-07-05

## Context

The engine is functionally complete across `math`, `geometry`, `physics`,
`spatial`, `slicing`, `core`, `renderer-three`, and `runtime`. The demos work,
the public API is settling, and we want the packages release-ready on npm.
Until now every package was `version: 0.0.0`, `private: true`, with
workspace-internal dependencies pinned to `"*"` and no release tooling — fine
for local development, not for publishing.

We need to decide: what the public API surface is, how packages are versioned
relative to each other, the starting version, and how releases are produced.

## Decision

### Public API surface

- Each package's **public API is its package entry point** (`./dist/index.js` /
  `index.d.ts`). The `exports` map exposes only `"."`, so deep imports into
  `dist/**` are unsupported and not covered by semver. This is the stable
  contract; internal modules may change freely.
- `@vanilla-slice/core` is the primary entry point for consumers and re-exports
  a curated facade of the underlying packages, so an application can depend on
  `core` alone (per the layering rules in ARCHITECTURE.md).
- Framework integrations remain out of this repo (ADR 0006).

### Versioning

- **Fixed / lockstep versioning.** All eight engine packages share one version
  and are released together. The engine is a cohesive whole with a tightly
  coupled internal dependency graph; independent versioning would add churn
  without benefit at this stage.
- **Start at `0.1.0`.** Pre-1.0 (`0.x`) semver signals the API is settling but
  not yet frozen: breaking changes may land in a **minor** bump (e.g. the recent
  `SliceVolume` → `{ plane, region }` reshape). We promote to `1.0.0` once the
  surface has proven stable across a release or two and we are ready to commit
  to full semver guarantees.
- Internal dependencies use caret ranges on the shared version (`^0.1.0`), which
  `nx release` bumps in lockstep.

### Tooling

- **`nx release`** (native to this Nx workspace) drives versioning, changelog,
  and publishing, configured in `nx.json` as a single `fixed` release group over
  the eight publishable packages. A `preVersionCommand` builds all packages
  before versioning. Release tags follow `v{version}`.
- Root scripts: `release`, `release:version`, `release:changelog`,
  `release:publish`, and `release:dry-run`.

### Package manifests

- The eight engine packages are publishable: `private` removed,
  `publishConfig.access = "public"` (required for a scoped public package),
  `files: ["dist"]`, `sideEffects: false` (all exports are pure — enables
  tree-shaking), `engines.node >= 18`, plus `description`/`keywords`/`license`.
- The two demo **apps stay `private`** and are never published.
- `three` is a **peerDependency** of `renderer-three` (with a dev dependency for
  building), so consumers control the Three.js version and avoid duplicate
  instances.

## Consequences

- **Positive:** one version to reason about; consumers can `npm i @vanilla-slice/core`
  and get a coherent set; tree-shakeable ESM with types; deep-import churn is not
  a semver concern; release is a single `nx release` command.
- **Negative:** lockstep means a change in one package bumps them all (acceptable
  for a cohesive engine); `0.x` asks consumers to expect breaking changes in
  minor bumps until `1.0.0`.
- **Prepared, not published:** this ADR makes the repo release-ready; the actual
  npm publish (registry auth, CI, provenance) is deferred.
- **Follow-ups (not blocking):**
  - Add `repository`, `homepage`, `bugs`, `author`, and a `LICENSE` file once the
    canonical repository URL / copyright holder are known.
  - Optional per-package `README.md` for npm package pages.
  - CI publish pipeline (ROADMAP Phase 7).
  - Decide the `1.0.0` criteria and cut it when the API has settled.

## Alternatives considered

- **Independent versioning per package:** rejected for now — unnecessary churn
  for a tightly-coupled engine; revisit if packages gain separate audiences.
- **Start at `1.0.0`:** rejected — the API is still changing (a public type was
  reshaped this cycle); `1.0.0` would over-promise stability.
- **Changesets / manual versioning:** rejected — `nx release` is native to the
  workspace and covers version + changelog + publish without extra tooling.
- **Bundler-emitted single-file dist (Rollup/tsup):** deferred — `tsc -b`
  already emits clean ESM + declarations; a bundler is only worth it if we later
  need minification or multiple output formats.

## Amendment — continuous delivery on push to master (2026-07-05)

Releases are automated with a GitHub Actions workflow
(`.github/workflows/release.yml`) triggered on push to `master`.

- **Version source: Conventional Commits.** `nx release` computes the bump from
  commit messages since the last `v*` tag (`fix:` → patch, `feat:` → minor,
  `feat!:`/`BREAKING CHANGE:` → major). No manual version input.
  - **0.x rule:** while pre-1.0, treat breaking changes as `feat:` (minor). A
    breaking-marked commit would compute `1.0.0`; reserve that for a deliberate
    `1.0.0` cut. Enforced by convention, not tooling.
- **One command:** the workflow runs lint/test/build, then `nx release --yes`,
  which versions, writes the changelog, commits, tags `v{version}`, pushes, and
  publishes to npm.
- **Loop avoidance:** the release commit message ends with `[skip ci]` (honored
  by GitHub Actions), plus a workflow `if:` guard skipping `chore(release):`
  commits.
- **No-op safety:** with `fallbackCurrentVersionResolver: "disk"` and a base tag
  present, a push with no releasable commits is a clean no-op (exit 0), so the
  workflow does not fail on ordinary pushes.
- **Auth:** `NODE_AUTH_TOKEN` (repo secret `NPM_TOKEN`) authenticates the publish;
  the default `GITHUB_TOKEN` (with `contents: write`) pushes the commit/tag and
  creates the GitHub Release. `master` is unprotected, so the default token can
  push directly.
- **Bootstrap:** the **first** release is run once manually to establish the
  initial `v0.1.0` tag and packages:
  `npx nx release 0.1.0 --first-release --yes` (with npm auth). Every release
  after that is automatic from Conventional Commits.

## Consequences (updated)

- **Positive:** one version to reason about; consumers can `npm i @vanilla-slice/core`
  and get a coherent set; tree-shakeable ESM with types; deep-import churn is not
  a semver concern; releases are hands-off after the first.
- **Negative:** lockstep means a change in one package bumps them all (acceptable
  for a cohesive engine); `0.x` asks consumers to expect breaking changes in
  minor bumps until `1.0.0`; Conventional Commit discipline is required for the
  automation to pick bumps.
- **Follow-ups (not blocking):**
  - npm publish **provenance** (`id-token: write` + `NPM_CONFIG_PROVENANCE`) for
    supply-chain attestation, once confirmed the repo is public.
  - Per-package `README.md` for npm pages.
  - Decide the `1.0.0` criteria and cut it when the API has settled.
