// Copies the pdf.js worker into public/ so the in-app document
// preview (components/DocPreview.tsx) can load it from the same
// origin. Runs on install and before every build/dev start.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js');
const dest = join(root, 'public/pdfjs/pdf.worker.min.js');
if (existsSync(src)) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
} else {
  console.warn('[copy-pdf-worker] pdfjs-dist not installed; preview falls back to the browser viewer.');
}
