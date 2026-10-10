# Install TrustGate in your editor

TrustGate 0.2.0 is an editor-neutral extension package using stable VS Code APIs, not Cursor-specific functionality. Its extension identifier remains `trustgate-local.trustgate`, so upgrading preserves existing settings and stored tokens in the same editor profile.

## Install

1. Start the backend from the project directory: `npm start`.
2. In a VS Code-compatible desktop editor, open the command palette and run **Extensions: Install from VSIX…**.
3. Select `dist/trustgate-0.2.0.vsix` and reload the editor if prompted.
4. Run **TrustGate: Set API Token**. Enter the developer token from your local backend `.env`.
5. Open a trusted Git workspace with an `origin` remote. Click the TrustGate shield or run **TrustGate: Open Security Review**.

VS Code also supports command-line installation:

```sh
code --install-extension dist/trustgate-0.2.0.vsix
```

Use the corresponding executable in other compatible editors. Credentials are stored separately in each editor's SecretStorage; installing in a second editor does not transfer the token automatically.

## Compatibility boundaries

| Environment | Support boundary |
|---|---|
| VS Code desktop | Targets stable API 1.93+; host smoke test still required on the installed version. |
| Windsurf desktop | Version 0.2.0 installed successfully in an isolated profile; live host workflow not confirmed. |
| Other VS Code-compatible desktop editors | Same package if stable API 1.93+ and Node workspace hosts are supported; not individually certified. |
| Remote SSH / container workspace | Workspace-host placement declared; run Git/Python there and configure a reachable backend. Not yet runtime-tested. |
| Browser-only editor / virtual workspace | Unsupported: this extension needs Node, filesystem and Git process access. Use the dashboard instead. |
| JetBrains, Neovim, other extension architectures | No native plugin included; use the standalone dashboard and Git CLI. |

`trustgate.backendUrl` defaults to `http://127.0.0.1:4318`. In a remote workspace, loopback refers to the remote extension host. Run the backend there or configure a reachable HTTPS endpoint. Backend and PDF dependencies are not bundled into the VSIX.

PDF import uses `python` on Windows and `python3` elsewhere. Override `trustgate.pythonPath` with the Python 3 executable that has pypdf installed. No shell command interpolation is used for PDF extraction.

## Verify a particular editor

Build the package with `npm run package:extension`. For automated host testing, use the target editor's CLI with `--extensionDevelopmentPath` pointing to this project's `extension/` and `--extensionTestsPath` pointing to `test/extension-host.js`. Use isolated user-data and extensions directories. A successful test writes `data/extension-host-result.json` containing the actual editor name and VS Code API version. A zero exit code without this artifact is not proof that the host test ran.

Then test: open sidebar → configure token → inspect a synthetic demo → import a real report → review an exact commit range. Verify that an expired or changed range is denied by the CLI gate. Do not label an editor end-to-end verified based only on package installation.

Reference: [VS Code's official VSIX distribution guidance](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).
