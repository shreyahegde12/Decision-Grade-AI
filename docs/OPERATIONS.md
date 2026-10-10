# Local operations and production boundaries

## Start and configure

Run `npm run setup`, configure optional HarnessRouter credentials in `.env`, then `npm start`. The service binds only to 127.0.0.1:4318. Copy the developer token into Cursor's **TrustGate: Set API Token** password field. Keep reviewer credentials separate. Never paste provider keys into chat or the webview. Keys are loaded once at startup; restart after rotation.

`GET /healthz` checks process liveness. `GET /readyz` checks whether the service accepts work and explicitly declares the manual Ezio integration mode. It does not claim provider availability. Review failures are persisted and shown to the user.

Only use one service process against a database. Queue capacity is 20 and concurrent jobs are limited to 2. Provider timeout is 90 seconds. A stopped service marks interrupted jobs failed on restart; queued jobs are resumed. Failed or queued jobs never grant permission. Reviews expire 15 minutes after creation, including time spent queued. Submit a new review after expiration.

## Secure token handling in terminal

For commands and Git launched from the same terminal, Node can load the local service environment without printing secrets:

```sh
node --env-file='/absolute/path/to/TrustGate/.env' '/absolute/path/to/TrustGate/src/cli.js' review BASE_SHA HEAD_SHA
```

To push with the hook, set the developer token in the terminal environment using your shell's hidden-input mechanism or local secret manager. The hook never sources a potentially attacker-controlled repository `.env` file. Do not place tokens in Git config, hook text, launch.json or tracked files.

## Backup and restore

Stop the service cleanly, copy the entire private `data/` directory (including WAL/SHM if present), and restart. Keep backups encrypted and private. To restore, stop the service, preserve the current directory, replace it from backup, and start again. Validate health and inspect the audit endpoint with reviewer credentials. Because approval expiry is absolute, old approvals should no longer authorize pushes. Do not edit audit rows to grant access. A backup restore drill has not been performed in this build environment.

No automatic retention policy is implemented in v1: review payloads remain until the local database is removed by its owner. Do not expose the service publicly without deciding retention and backups.

## Docker

`docker compose up --build -d` uses a non-root container, persistent SQLite volume, loopback port publishing, read-only root filesystem, dropped capabilities and restart policy. Production configuration requires HarnessRouter credentials and disables synthetic demos. It does not imply live Ezio API verification. Docker startup was not verified in the sandbox because daemon access was denied.

## A later hosted rollout

Before public exposure: TLS reverse proxy, request/body limits, secure secret injection, restricted service reachability, stable Node version pinning, structured request/error telemetry, SSO/per-user authorization, retention, monitoring, backup-restore validation, dependency/SAST tooling and load/security testing. Replace the shared single-organization token model before multi-tenant use. The local audit log is transactional but is not externally tamper-proof.

For GitHub enforcement, deploy the gate from a trusted revision in a required protected-branch check. Compute the same repository identity and exact base/head objects, use only a developer/check credential, and query the service from a trusted runner. Do not run untrusted PR scripts with service credentials, and never expose the reviewer token to CI. Configure branch rules outside the submitted repository so a PR cannot remove the requirement. This integration has not been installed because no target repository was provided and the chosen deployment is local.

## Failure response

| Symptom | Response |
|---|---|
| 401 | Set the correct backend token; restart after rotating server secrets. |
| 403 on reviewer action | Use the designated reviewer credential. |
| Provider failure | Verify key, configured harness ID, endpoint mode and provider availability. No approval is inferred. |
| PDF cannot be read | Install pypdf, or export/select plain text. Scanned PDFs require OCR outside v1. |
| Gate rejects approved-looking UI | Check expiry, exact commit/base, remote identity and preview vs commit scope. |
| Existing hook | Manually integrate CLI into the established hook; installer does not overwrite it. |
| Oversized diff | Split the change. No silent truncation is accepted. |
| Missing remote object | Fetch and create a fresh review for the actual push range. |
| Hard block | Fix and re-review. Reviewers cannot override hard blocks. |
