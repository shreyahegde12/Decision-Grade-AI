"""Create a standard VSIX without fetching a packaging dependency."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import shutil
root = Path(__file__).resolve().parent.parent
ext = root / 'extension'
(ext / 'lib').mkdir(exist_ok=True)
for name in ['git.js', 'policy.js', 'client.js']:
    shutil.copyfile(root / 'src' / name, ext / 'lib' / name)
shutil.copytree(root / 'fixtures', ext / 'fixtures', dirs_exist_ok=True)
(root / 'dist').mkdir(exist_ok=True)
manifest = '''<?xml version="1.0" encoding="utf-8"?><PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011"><Metadata><Identity Language="en-US" Id="trustgate" Version="0.1.0" Publisher="trustgate-local"/><DisplayName>TrustGate</DisplayName><Description xml:space="preserve">Evidence-based security review for Cursor</Description><Tags>security,trust</Tags><Categories>Other</Categories><GalleryFlags>Public</GalleryFlags><Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.93.0"/><Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value=""/><Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value=""/></Properties></Metadata><Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation><Dependencies/><Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/></Assets></PackageManifest>'''
with ZipFile(root / 'dist' / 'trustgate-0.1.0.vsix', 'w', ZIP_DEFLATED) as z:
    z.writestr('extension.vsixmanifest', manifest)
    z.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="json" ContentType="application/json"/><Default Extension="js" ContentType="application/javascript"/><Default Extension="svg" ContentType="image/svg+xml"/><Default Extension="py" ContentType="text/plain"/><Default Extension="md" ContentType="text/markdown"/><Default Extension="vsixmanifest" ContentType="text/xml"/></Types>')
    for p in ext.rglob('*'):
        if p.is_file() and '__pycache__' not in str(p):
            z.write(p, 'extension/' + str(p.relative_to(ext)))
print(root / 'dist' / 'trustgate-0.1.0.vsix')
