# TrustGate for Cursor

Open the TrustGate shield in the activity bar. Configure your backend token through **TrustGate: Set API Token**. Use **Review commit range** for push decisions, **Check saved changes** for previews, and **Import Ezio report** for evidence-driven report decisions.

The backend must be running at the configured URL. PDF import needs Python 3 and pypdf. Read the repository README for backend setup, provider credentials, the Git hook and scope limitations.

TrustGate is a local MVP. It does not prove code is vulnerability-free. Generic Ezio reports cannot authorize unrelated code pushes, and the local Git hook is bypassable by its owner.
