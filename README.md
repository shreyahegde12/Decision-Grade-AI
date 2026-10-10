# TrustGate

Start here: **[quickstart.md](quickstart.md)**. For test results and verification limits, see **[docs/VALIDATION.md](docs/VALIDATION.md)**.

An evidence-driven security review extension for **VS Code-compatible desktop editors**. It maps low trust to BLOCK, medium trust to ESCALATE, and high trust to APPROVE. An exact-content Git gate prevents an old approval from authorizing a different change.

**Current status:** implemented local MVP with production-oriented boundaries, not a certified security scanner or a completed production rollout. Ezio integration is PDF/text report import. HarnessRouter uses its documented live API when configured. No Ezio API endpoint has been invented. Synthetic examples are clearly labeled and cannot authorize code pushes.

Read [the end-to-end system design](docs/SYSTEM_DESIGN.md) for frontend, backend, persistence, evidence flow, permissions, deployment and limitations. Read [operations](docs/OPERATIONS.md) and [the demo script](docs/DEMO.md).

## Editor compatibility

TrustGate ships as one standard VSIX targeting the stable VS Code API (`^1.93.0`), without Cursor-specific APIs. Install the same file in VS Code or a compatible desktop editor such as Cursor. Other compatible forks can use the same package, but each editor must support the required API and a Node extension host. See [editor setup and verification](docs/EDITORS.md).

This is not a browser extension or a native JetBrains/Neovim plugin. The standalone dashboard and Git CLI work independently of editor integration. Cross-editor runtime testing remains pending; successful VSIX installation alone is not an end-to-end compatibility test.

## Local setup

Requires Node 24+, Python 3 for packaging, Git, and a desktop editor supporting the VS Code extension API 1.93 or later. PDF import also needs `pypdf` (`python3 -m pip install pypdf`). No npm packages are required by the service or extension.

```sh
npm run setup
npm test
npm run package:extension
npm start
```

**Browser dashboard:** after `npm start`, open **http://127.0.0.1:4318/**. Connect using `TRUSTGATE_TOKEN` from your private `.env`. No editor extension is required for the dashboard. It shows the latest 50 reviews, refreshes every 10 seconds, and lets you inspect evidence, submit text-based Ezio reports, and run clearly labeled synthetic demos. Use the reviewer token only when recording reviewer decisions. Tokens stay in tab memory and are forgotten on reload/disconnect.

For PDF import directly from a file, use the editor extension; the dashboard accepts pasted report text or `.txt`/`.md` exports. Live report analysis requires HarnessRouter configuration. Browser access is restricted to the local service origin (`127.0.0.1` or `localhost` at the configured port); no CORS access is enabled for other websites.

Setup creates a private, gitignored `.env`, with separate random developer and reviewer tokens. It never prints them or overwrites an existing file. Configure `HR_API_KEY` and `HR_HARNESS_ID` in that file to enable live agent analysis. Use a configured read-only review harness with execution and network tools disabled: the agent only needs to return JSON from supplied text. Cloud defaults to `https://api.harnessrouter.ai/{harness_id}/v1/responses`. For Community Edition, set `HR_MODE=ce` and its API base URL.

In VS Code or another compatible desktop editor:

1. Extensions → **Install from VSIX…** → `dist/trustgate-0.2.0.vsix`.
2. Open a Git repository with an `origin` remote.
3. Run **TrustGate: Set API Token**. Use the developer token from `.env` (stored in your editor’s SecretStorage).
4. Open the shield in the activity bar. Use **Check saved changes** or **Review commit range**.
5. To resolve an escalation, set the reviewer token through the same command, inspect the exact diff/evidence, and record a substantive approval or rejection reason. In a team, keep this credential with the reviewer.

Auto-check is opt-in because diffs leave the editor. Enable `trustgate.autoCheck`; choose 180 or 300 seconds. Workspace edits mark code results outdated. Preview scans include saved tracked changes only. Unsaved buffers must be saved first; untracked files are not included. Commit scans include committed files and bind approval to the remote baseline and commit.

## Real Ezio reports

The challenge supplies four samples: nuclear energy, work from home, EV market and AGI timelines. Generate exports at [Ezio](https://ezioai.io/) using the event code from [the official challenge](https://github.com/ezioai/Build-Trust-Agent/blob/main/buildathon_challenge.md). In your editor choose **Import Ezio report**, select the PDF or text export, then describe the relying person and decision. With HarnessRouter configured, the agent extracts evidence; every claim/finding quote is checked against the original text before the policy evaluates it.

User-imported provenance is explicit. Imported reports are not authenticated Ezio API responses. Report approval authorizes the stated report-use decision, never an unrelated code push. Until an authoritative Ezio code-verification contract is available, code reviews escalate for explicit human risk acceptance unless blocked by findings.

## Push gate

From the repository you want to protect, run the CLI using its absolute path:

```sh
node '/absolute/path/to/TrustGate/src/cli.js' install-hook
```

The installer refuses to overwrite an existing hook or a custom `core.hooksPath`. The Git process needs `TRUSTGATE_TOKEN` and optionally `TRUSTGATE_URL`; these are not read from repository files by the hook. Editor GUI Git pushes must inherit these environment variables when the editor starts, or use a terminal push with them set. The extension token in SecretStorage is intentionally not copied into hooks or source files.

Review after committing, before pushing. The extension command uses the local upstream ref as base. If remote state has moved, fetch and review again. New branches are reviewed from the empty tree. For an explicit range:

```sh
node '/absolute/path/to/TrustGate/src/cli.js' review BASE_SHA HEAD_SHA
node '/absolute/path/to/TrustGate/src/cli.js' check BASE_SHA HEAD_SHA
```

The pre-push gate reads every ref update, recomputes its fingerprint, and requires a current backend approval for each. Approval expires after 15 minutes. Tags, branch deletion, unavailable remote objects and backend failures are denied in v1. An installed hook points to this checkout: keep it in place or reinstall after moving it.

**A local hook is bypassable.** It is not equivalent to protected-branch enforcement. This repository's GitHub workflow validates TrustGate itself; it does not install a required organizational security check. See the runbook for that rollout boundary.

## Validation and demos

```sh
npm test                 # actual handlers + SQLite, in-process transport
npm run test:http        # same integration cases over real loopback HTTP
npm run demo             # synthetic policy fixtures, no provider calls
```

With the service running in local demo mode, Your editor’s **TrustGate: Run Synthetic Policy Demo** command offers the same four fixtures in the sidebar. The UI labels them synthetic; use genuine exports for submission.

Tests cover evidence grounding, all decision branches, role separation, exact-content binding, expiration, hard-block behavior, provider failures, and multi-ref Git pushes. The HTTP mode is separate for restricted development environments. `docs/VALIDATION.md` records what actually ran in the build environment.

## Security and scope

- The model advises; a deterministic policy and authenticated reviewer control disposition.
- Confidence and human approval are separate. Risk acceptance does not raise the evidence score.
- Critical local secret patterns block before external analysis. Detection is deliberately limited, and other secrets may not be detected. Use approved non-sensitive hackathon repositories.
- Provider credentials stay server-side; the webview has no credentials or external scripts.
- SQLite contains review text and diffs. Treat the data directory as sensitive. Access is single-organization, not multi-tenant.
- A green report is not proof that code is vulnerability-free. Comprehensive SAST, dependency analysis, full-repository coverage, SSO and automated Ezio verification are future integrations.

## Layout

| Path | Responsibility |
|---|---|
| `extension/` | Editor sidebar, status, scheduling and import |
| `dashboard/` | Standalone browser dashboard, history and evidence inspector |
| `src/server.js`, `src/store.js` | Authenticated API, worker queue and SQLite audit |
| `src/policy.js` | Evidence validation and deterministic decisions |
| `src/provider.js` | HarnessRouter cloud/CE adapter |
| `src/git.js`, `src/cli.js` | Snapshot binding and push enforcement |
| `fixtures/` | Explicitly synthetic policy examples |
| `test/` | Policy, provider, API and Git integration tests |
