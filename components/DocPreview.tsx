'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { Icon } from './icons';
import { downloadPdf, printPdf, shareDocument } from './finderActions';

/**
 * Preview a document in a popup without leaving the page.
 *
 * PDFs are drawn page by page with pdf.js — the same on desktop,
 * iPhone Safari, and the Android app's WebView (which has no
 * built-in PDF viewer, so an <iframe> would show nothing there).
 * If pdf.js can't load, the browser's own viewer is used instead.
 * Images and plain text attachments are shown directly.
 *
 * Nothing here changes the document: Download, Print, and Share
 * act on the same URL the context menus use.
 */
export interface PreviewTarget {
  title: string;
  /** Same-origin URL of the file. */
  url: string;
  /** MIME type when known; PDFs are assumed otherwise. */
  contentType?: string;
  /** Small print under the viewer (e.g. the signature note). */
  note?: string;
}

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (o: { scale: number }) => { width: number; height: number };
    render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
  }>;
  destroy: () => Promise<void>;
};

const ZOOMS = [0.75, 1, 1.25, 1.5, 2];

export default function DocPreview({
  target,
  onClose,
}: {
  target: PreviewTarget;
  onClose: () => void;
}) {
  const type = (target.contentType || 'application/pdf').toLowerCase();
  const isPdf = type.includes('pdf');
  const isImage = type.startsWith('image/');
  const isText = type.startsWith('text/');

  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback' | 'error'>('loading');
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const docRef = useRef<PdfDoc | null>(null);

  // Load the file once.
  useEffect(() => {
    let live = true;
    let objUrl: string | null = null;
    (async () => {
      try {
        const res = await fetch(target.url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (isText) {
          const t = await res.text();
          if (live) { setText(t); setStatus('ready'); }
          return;
        }
        const buf = await res.arrayBuffer();
        objUrl = URL.createObjectURL(new Blob([buf], { type: isPdf ? 'application/pdf' : type }));
        if (live) setBlobUrl(objUrl);
        if (!isPdf) { if (live) setStatus('ready'); return; }
        try {
          const pdfjs = await import('pdfjs-dist/legacy/build/pdf');
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';
          const doc = (await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise) as unknown as PdfDoc;
          if (!live) { void doc.destroy(); return; }
          docRef.current = doc;
          setPages(doc.numPages);
          setStatus('ready');
        } catch {
          if (live) setStatus('fallback');
        }
      } catch {
        if (live) setStatus('error');
      }
    })();
    return () => {
      live = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
      void docRef.current?.destroy();
      docRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.url]);

  // (Re)draw every page to fit the viewer width at the chosen zoom.
  useEffect(() => {
    const doc = docRef.current;
    const host = pagesRef.current;
    if (status !== 'ready' || !isPdf || !doc || !host) return;
    let cancelled = false;
    (async () => {
      host.innerHTML = '';
      const avail = Math.max(240, host.clientWidth - 4);
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      for (let n = 1; n <= doc.numPages; n++) {
        if (cancelled) return;
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const cssScale = (avail / base.width) * zoom;
        const vp = page.getViewport({ scale: cssScale * dpr });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.style.width = `${Math.floor(vp.width / dpr)}px`;
        canvas.style.height = `${Math.floor(vp.height / dpr)}px`;
        canvas.className = 'docpage';
        canvas.setAttribute('aria-label', `Page ${n} of ${doc.numPages}`);
        host.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
      }
    })();
    return () => { cancelled = true; };
  }, [status, zoom, isPdf, pages]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2400);
    return () => clearTimeout(t);
  }, [notice]);

  const zi = ZOOMS.indexOf(zoom);
  const toolbar = (
    <>
      {isPdf && status === 'ready' && (
        <span className="doczoom" role="group" aria-label="Zoom">
          <button type="button" className="iconbtn" aria-label="Zoom out" disabled={zi <= 0} onClick={() => setZoom(ZOOMS[Math.max(0, zi - 1)])}>−</button>
          <span className="doczoom-val">{Math.round(zoom * 100)}%</span>
          <button type="button" className="iconbtn" aria-label="Zoom in" disabled={zi >= ZOOMS.length - 1} onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, zi + 1)])}>+</button>
        </span>
      )}
    </>
  );

  const footer = (
    <div className="docpreview-actions">
      <button type="button" className="btn" onClick={() => downloadPdf(target.url)}>
        <Icon name="download" size={16} /> Download
      </button>
      {(isPdf || isImage) && (
        <button type="button" className="btn" onClick={() => { void printPdf(target.url); }}>
          <Icon name="printer" size={16} /> Print
        </button>
      )}
      <button
        type="button"
        className="btn"
        onClick={() => {
          void shareDocument(target.title, target.url).then((r) => {
            setNotice(r === 'copied' ? 'Link copied.' : r === 'failed' ? 'Sharing is not available here.' : null);
          });
        }}
      >
        <Icon name="share" size={16} /> Share
      </button>
      {isPdf && pages > 0 && <span className="fineprint docpagecount">{pages} page{pages === 1 ? '' : 's'}</span>}
    </div>
  );

  return (
    <Modal title={target.title} onClose={onClose} size="wide" headerActions={toolbar} footer={footer}>
      {notice && <p className="finder-notice" role="status">{notice}</p>}
      <div className="docviewer" data-noswipe>
        {status === 'loading' && (
          <div className="docviewer-msg">
            <span className="spinner" aria-hidden="true" /> Loading preview…
          </div>
        )}
        {status === 'error' && (
          <div className="docviewer-msg">
            The preview couldn’t be loaded. Try Download instead.
          </div>
        )}
        {status === 'fallback' && blobUrl && (
          <iframe className="docframe" src={blobUrl} title={target.title} />
        )}
        {status === 'ready' && isPdf && <div className="docpages" ref={pagesRef} />}
        {status === 'ready' && isImage && blobUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="docimage" src={blobUrl} alt={target.title} />
        )}
        {status === 'ready' && isText && <pre className="doctext">{text}</pre>}
        {status === 'ready' && !isPdf && !isImage && !isText && (
          <div className="docviewer-msg">
            This kind of file can’t be previewed here. Use Download to open it.
          </div>
        )}
      </div>
      {target.note && <p className="fineprint">{target.note}</p>}
    </Modal>
  );
}
