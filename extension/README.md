# TrustGate for VS Code-compatible editors

One VSIX, using stable VS Code APIs (`^1.93.0`) and a Node workspace extension host. Install through **Extensions: Install from VSIX…** in VS Code or another compatible desktop editor. No editor-specific account or AI subscription is required by TrustGate. The backend has its own provider configuration.

Open the TrustGate shield in the activity bar. Configure your backend token through **TrustGate: Set API Token**. Use **Review commit range** for push decisions, **Check saved changes** for previews, and **Import Ezio report** for evidence-driven report decisions.

The backend must be running at the configured URL. PDF import needs Python 3 and pypdf. Read the repository README for backend setup, provider credentials, the Git hook and scope limitations.

Set `trustgate.pythonPath` if your Python executable is not on PATH. The default is `python` on Windows and `python3` on macOS/Linux. For remote workspaces, Git, Python, and backend connectivity must be available from the remote extension host; its localhost is not your desktop. Browser-only editor hosts and virtual workspaces are not supported by this Node extension.

TrustGate is a local MVP. It does not prove code is vulnerability-free. Generic Ezio reports cannot authorize unrelated code pushes, and the local Git hook is bypassable by its owner.
