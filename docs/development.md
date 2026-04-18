# Development Guide

This document is the practical reference for running, validating, and troubleshooting Protocol Forge during development.

## Prerequisites

- Node.js 22+
- pnpm 10+
- macOS, Linux, or Windows development environment

## Install

```bash
pnpm install
```

## Run in Development

```bash
pnpm dev
```

This starts Electron main/preload/renderer with hot reload.

## Available Scripts

- `pnpm dev`: start local development mode.
- `pnpm start`: preview built app.
- `pnpm lint`: run ESLint.
- `pnpm typecheck`: run TypeScript checks for node + web targets.
- `pnpm test --run`: run Vitest once.
- `pnpm build`: typecheck + production build through electron-vite.
- `pnpm build:unpack`: create unpacked distributable output.
- `pnpm build:mac|win|linux`: produce platform installers/packages.

## Validation Commands

Run these after code or config changes:

```bash
pnpm lint
pnpm typecheck
pnpm test --run
```

Run build checks when packaging/runtime wiring is impacted:

```bash
pnpm build
```

## Test Notes

- Unit tests cover stores, transport factory/transports, session lifecycle, and repository/session messaging behavior.
- Prefer adding targeted tests for touched modules, then run full suite.

## Project Layout

- `src/main`: Electron main process, IPC handlers, session manager, persistence.
- `src/preload`: typed bridge exposed to renderer.
- `src/renderer/src`: React app, Zustand stores, UI components.
- `src/shared`: shared types/constants/errors and IPC contracts.
- `tests`: Vitest unit tests.
- `context`: project planning, status, and architecture decisions.

## Local Persistence

- Storage engine: SQLite (`better-sqlite3`) in WAL mode with foreign keys enabled.
- Database file: `protocol-forge.db` in Electron `userData` directory.
- Primary tables: `server_profiles`, `sessions`, `messages`.

## Local MCP Server Examples

### Stdio server

Configure a profile with transport `stdio`.

Example command:

```text
command: npx
args: @modelcontextprotocol/server-everything
```

### SSE server

Configure a profile with transport `sse` and set `url`.

## Debugging Playbook

### Session fails to connect

- For `stdio`, validate command/args/cwd and run the command manually from the same directory.
- For `sse`, verify endpoint URL, scheme (`http`/`https`), and required headers.
- Profile input tolerates optional labels like `command:`, `args:`, and `url:`. They are sanitized on save.
- Legacy saved stdio args that accidentally start with `args:` are normalized at connect time.

### Discovery calls fail

- Confirm session is `ready`.
- Check protocol inspector for inbound/outbound message shape and MCP error payloads.

### Native module issues (`better-sqlite3`)

If native binaries are mismatched:

```bash
pnpm rebuild:native
```

Then re-run:

```bash
pnpm typecheck
pnpm test --run
```

## Troubleshooting

- Native dependency build errors: run `pnpm install` again and ensure your system toolchain is available.
- Session connect failures: verify command/url and inspect protocol errors in the inspector.
- Empty discovery lists: ensure session state is `ready` before listing tools/resources/prompts.
- If a profile still fails after edits, re-save it once so stored fields are normalized.

## Error Handling Expectations

- Treat all renderer inputs and server responses as untrusted.
- Main-process handlers should throw actionable errors for renderer display.
- Prefer stable fallback UI over hard crashes (toasts + error boundaries).

## Release Process

Releases are cut by pushing a `v*.*.*` tag. The `release.yml` workflow builds
mac, Windows, and Linux artifacts in parallel and uploads them to a draft
GitHub release (via `electron-builder --publish always`).

### Local pre-flight

Run the same gates CI runs, so a failing build isn't discovered on a tag push:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Manually sanity-check a packaged build on at least one platform:

```bash
pnpm build:mac   # or :win / :linux
```

Launch the packaged app, create a stdio profile, connect, list tools, invoke
one, and watch the Protocol Inspector stream.

### Cutting a release

1. Bump `version` in `package.json` and `APP_VERSION` in
   `src/shared/constants.ts` (keep these in sync).
2. Move the `CHANGELOG.md` entry's date to the intended release day.
3. Commit: `chore(release): bump to vX.Y.Z`.
4. Tag and push:
   ```bash
   git tag vX.Y.Z
   git push origin main vX.Y.Z
   ```
5. Wait for the Release workflow to finish. A draft release with five artifacts
   (mac dmg + zip, win nsis, linux AppImage + deb) and the `latest*.yml`
   update manifests will appear under Releases. **Do not publish the draft
   until all three matrix jobs have completed** — electron-builder refuses
   to upload to an already-published (non-draft) release, so publishing
   early will break any job that hasn't finished yet.
6. Install and smoke-test the draft artifacts on each target OS. Verify the
   Gatekeeper / SmartScreen first-launch paths documented in the README.
7. Edit the draft release notes (summarize from `CHANGELOG.md`) and publish.

### Release candidates

Use `vX.Y.Z-rc.N` tags to produce draft releases without touching the
canonical tag — the tag pattern matches. Delete the draft release afterwards.
