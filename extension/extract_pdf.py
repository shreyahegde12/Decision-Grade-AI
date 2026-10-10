"""Extract a text-based Ezio PDF; no OCR and no network calls."""
import sys
from pypdf import PdfReader
reader = PdfReader(sys.argv[1])
if len(reader.pages) > 100:
    raise ValueError('Report exceeds 100 pages')
text = '\n'.join(page.extract_text() or '' for page in reader.pages)
if not text.strip() or len(text) > 500000:
    raise ValueError('Empty or oversized report text')
sys.stdout.write(text)
