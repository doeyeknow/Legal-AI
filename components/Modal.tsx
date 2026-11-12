'use client';

import { useEffect, type ReactNode } from 'react';
import { Icon } from './icons';

/**
 * The app's one popup shell for add/edit forms: a bottom sheet on
 * phones, a centered card on wider screens. Generic by design —
 * title + children + onClose — so any form (and future features
 * like the inbox confirm-add-to-case prompts) can mount inside it.
 *
 * Closing NEVER submits anything: the backdrop, the ✕ button, and
 * the Escape key all just call onClose. Saving stays with the
 * form's own submit button, which closes the modal itself on
 * success. The page behind never scrolls (the shell is fixed);
 * a long form scrolls inside the sheet.
 */
export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modalbackdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modalcard"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalhead">
          <h3>{title}</h3>
          <button
            type="button"
            className="modalx"
            aria-label="Close"
            onClick={onClose}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="modalbody">{children}</div>
      </div>
    </div>
  );
}
