'use client';

/** Shared document actions for the Finder's context menus —
 *  used by the case folders, the evidence locker, and the case
 *  page's document rows. All of them are safe to fail: nothing is
 *  mutated until the user confirms a trash. */

/** Fetch a case's newest document id (documents are returned
 *  newest-first). Returns null when the case has none. */
export async function newestDocumentId(caseId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}`);
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const docs = data?.case?.documents;
    return Array.isArray(docs) && docs.length ? String(docs[0].id) : null;
  } catch {
    return null;
  }
}

export function documentPdfUrl(caseId: string, docId: string): string {
  return `/api/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(docId)}/pdf`;
}

/** Download: let the browser save the regenerated PDF. */
export function downloadPdf(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Print: load the PDF and hand it straight to the print dialog. */
export async function printPdf(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.src = objUrl;
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch { /* fall through to opening it */ }
    };
    document.body.appendChild(frame);
    setTimeout(() => { URL.revokeObjectURL(objUrl); frame.remove(); }, 60_000);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

/** Share: the native share sheet when available, otherwise copy
 *  the document's link to the clipboard. */
export async function shareDocument(title: string, url: string): Promise<string> {
  const abs = new URL(url, window.location.origin).toString();
  const nav = navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({ title, url: abs });
      return 'shared';
    } catch { /* cancelled or unsupported — fall through to copy */ }
  }
  try {
    await navigator.clipboard.writeText(abs);
    return 'copied';
  } catch {
    return 'failed';
  }
}
