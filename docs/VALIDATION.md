# Validation record

Date: 2026-10-10. Host: macOS arm64, Node 24.1.0, Python 3.13.5, pypdf 6.12.2, Cursor 3.1.10.

## Passed

- `npm test`: **24 tests passed**, none failed or skipped. Uses actual HTTP handlers and SQLite with an in-process request transport. Provider responses are explicitly mocked; these are not live provider tests.
- Real temporary Git repositories: committed vs working-tree snapshots, fingerprint changes and multi-ref push rejection.
- Evidence policy: support, contradiction, uncertainty, source dates, coverage, score handling, quote grounding, critical findings and code/report separation.
- API/database: authentication, reviewer role, reasoned resolution, replay denial, expiry, new-review invalidation, failed providers, audit records, restart recovery, transaction rollback and synthetic-mode isolation.
- `npm run demo`: four **synthetic** topic fixtures produce evidence-driven block/escalate/approve branches. These are not official Ezio exports and do not establish hackathon completion.
- `npm run package:extension`: generated `dist/trustgate-0.1.0.vsix`.
- Cursor CLI installed the VSIX successfully into an isolated local test profile under `data/`. The user's normal Cursor profile was not changed.
- Extension JavaScript syntax checked. Python/pypdf dependency is present; no real Ezio PDF has been supplied for extraction verification.

## Blocked or not verified

- `npm start` and socket-based tests: sandbox denies binding `127.0.0.1` with `EPERM`. No HTTP server is currently running. Run `npm start` and `npm run test:http` in a normal local terminal.
- Docker: daemon socket access denied. Container configuration is delivered but not built/run here.
- Cursor extension-host smoke test launch returned without its expected result artifact. Activation and visual sidebar behavior are **not confirmed** by the successful package installation.
- Browser runtime failed during startup on both attempts. Ezio's interactive Try flow and sidebar visual review could not be exercised.
- HarnessRouter live run: no API key/configured harness supplied.
- Ezio real-report processing: actual exported PDFs/text are still required. Automated Ezio code verification has no documented API contract available to this implementation.
- No real push was performed, no GitHub branch protection was configured, and no cloud service was deployed. The requested deployment scope is local hackathon use.

## Next local verification

1. Configure HarnessRouter key and harness ID locally in `.env`.
2. Run `npm start`, then `npm run test:http` in another terminal.
3. Install the VSIX in normal Cursor, configure its API token, and open a Git repository with an origin remote.
4. Import two genuine reports from different official Ezio samples and inspect grounded claim/source reasoning.
5. Review a commit range, resolve an escalation with the reviewer credential, and verify the gate accepts that range but rejects a changed range.
6. Visually inspect the sidebar, then record the 1–2 minute demonstration.

This is an implemented local MVP with explicit production boundaries, not a completed or certified production deployment.
