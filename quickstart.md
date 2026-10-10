# TrustGate quickstart

Run the dashboard first. Add the editor extension if you want checks inside VS Code, Cursor, Windsurf, or another compatible desktop editor.

## 1. Start locally

Requires **Node.js 24+**. Run these commands from the project folder:

```sh
npm run setup
npm start
```

No `npm install` is needed: the application uses Node's built-in modules. Setup creates a private `.env` with random developer and reviewer tokens, and enables local synthetic demos. If `.env` already exists, setup leaves it unchanged.

Keep this terminal running. Open **http://127.0.0.1:4318/** in your browser.

In the connection form, enter the **value** of `TRUSTGATE_TOKEN` from `.env`, without the `TRUSTGATE_TOKEN=` prefix. This is your local application token, not a HarnessRouter API key.

## 2. Try a test report without provider keys

Make sure `.env` contains `TRUSTGATE_ALLOW_DEMO=true`. Restart `npm start` after changing environment settings.

In the dashboard, scroll to **Explore a synthetic example** and select a sample. Wait for the next refresh (up to 10 seconds), or click **Refresh**. Select the review to inspect its decision and evidence.

| Synthetic sample | Expected decision |
|---|---|
| Nuclear energy | Block |
| Work from home | Escalate / Needs review |
| EV market | Approve |
| AGI timelines | Escalate / Needs review |

The test reports are JSON fixtures in [`fixtures/`](fixtures/). They are **not real Ezio reports** and cannot approve a code push. You can also run all four without a server:

```sh
npm run demo
```

To try human review, disconnect from the dashboard and reconnect using the value of `TRUSTGATE_REVIEWER_TOKEN`. Select an unexpired escalation, inspect its evidence, and record an approval or rejection with a reason of at least 20 characters. Hard blocks cannot be overridden. Reviews expire after 15 minutes.

## 3. Install the editor extension (optional)

Use the existing **`dist/trustgate-0.2.0.vsix`**. If it is missing, build it with Python 3:

```sh
npm run package:extension
```

1. In your editor's command palette, run **Extensions: Install from VSIX…**.
2. Select `dist/trustgate-0.2.0.vsix`; reload the editor if prompted.
3. Run **TrustGate: Set API Token** and enter the value of `TRUSTGATE_TOKEN`.
4. Open a trusted Git repository with an initial commit and an `origin` remote.
5. Open the TrustGate shield, or run **TrustGate: Open Security Review**.
6. Use **Check saved changes** for a preview, or **Review commit range** after committing and before pushing.

Keep the backend running. `trustgate.backendUrl` defaults to `http://127.0.0.1:4318`. For background checks, enable `trustgate.autoCheck` and choose `trustgate.intervalSeconds` of `180` or `300` in editor settings. Preview checks cover saved, tracked files; save unsaved buffers first. They do not grant commit approval.

For a fixture-only editor demo, run **TrustGate: Run Synthetic Policy Demo**. No repository is needed for this command.

The Git push hook is installed separately; see [push-gate setup](README.md#push-gate). Installing the extension alone does not enforce pushes.

## 4. Analyze a real Ezio report

Set these locally in `.env`, then restart the backend:

```dotenv
HR_API_KEY=your-workspace-api-key
HR_HARNESS_ID=your-configured-review-harness-id
```

Use a review harness configured to analyze supplied text and return JSON, with execution/network tools disabled. Do not send API keys in chat or enter them into the dashboard connection form.

Generate and export a genuine report from [Ezio](https://ezioai.io/), using the [official challenge instructions](https://github.com/ezioai/Build-Trust-Agent/blob/main/buildathon_challenge.md).

- **Dashboard:** click **New report review**, state who relies on the answer and for what, then paste report text or choose a `.txt`/`.md` file.
- **Extension:** run **TrustGate: Import Ezio Report** and choose a PDF or text file. PDF import requires Python 3 and `pypdf` installed in that interpreter. Set `trustgate.pythonPath` if needed.

HarnessRouter analyzes the report; TrustGate validates quoted evidence and applies its decision policy. The current Ezio integration is report import, not an automated Ezio code-verification API. Code checks require reviewer risk acceptance unless blocked; a general report cannot approve unrelated code.

For the hackathon, demonstrate two genuine reports from different official samples. Synthetic fixtures do not satisfy that requirement.

## 5. Run the tests

In a separate terminal, from the project folder:

```sh
npm test
npm run test:http
```

- `npm test`: policy, API, database, Git and dashboard tests using an in-process transport. Latest recorded result: **28 passing tests**.
- `npm run test:http`: runs the cases over real loopback HTTP. It starts its own temporary test servers; the dashboard server is not required. Run in a normal terminal that permits local listening ports. This npm command uses POSIX environment-variable syntax; on Windows PowerShell use `$env:TRUSTGATE_TEST_HTTP='1'; npm test` and remove it afterward with `Remove-Item Env:TRUSTGATE_TEST_HTTP`.
- These tests mock provider responses; they do not prove a live HarnessRouter or Ezio integration works.

**The test-results document is [`docs/VALIDATION.md`](docs/VALIDATION.md).** It records what passed and what remains unverified. The actual tests are under [`test/`](test/). A demo-video outline is in [`docs/DEMO.md`](docs/DEMO.md).

## Common startup issues

| Symptom | What to do |
|---|---|
| `{"error":"Unauthorized"}` when opening port 4318 | Open the root URL `/`, not `/v1/...`. If root still returns JSON, stop the old backend with Ctrl+C, run `npm start` again from this project, then hard-refresh the browser. |
| Unauthorized in the dashboard connection form | Use the current `TRUSTGATE_TOKEN` value from `.env`. Restart the backend after changing tokens. |
| Port already in use | Stop the earlier TrustGate process in its terminal before starting another. |
| No synthetic examples visible | Set `TRUSTGATE_ALLOW_DEMO=true`, restart, and reconnect. |
| HarnessRouter not configured | Synthetic demos still work; real report analysis needs the key and harness ID above. |
| PDF extraction fails | Install `pypdf` for the configured Python executable, or import plain text. |
| `EPERM` while starting the server | Run from your normal local terminal; the agent sandbox previously denied local listening ports. |

Full editor compatibility and remote-workspace notes: [`docs/EDITORS.md`](docs/EDITORS.md).
