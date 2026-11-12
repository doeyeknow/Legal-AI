'use client';

import { useState, type ReactNode } from 'react';
import Modal from './Modal';
import { Icon } from './icons';

/**
 * A small "?" chip. The app keeps its screens lean: any longer
 * explanation, tip, or legal fineprint that used to sit inline on
 * the page lives behind this button instead, in a popup modal.
 * Nothing is lost — it is one tap away, and it never submits or
 * changes anything.
 */
export default function HelpTip({
  title,
  label,
  children,
}: {
  /** The modal's heading, e.g. "What is this?" */
  title: string;
  /** Spoken label for the button; defaults to "More about <title>". */
  label?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="helptip"
        aria-label={label || `More about ${title}`}
        title={title}
        onClick={() => setOpen(true)}
      >
        <Icon name="help" size={14} />
      </button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          {children}
        </Modal>
      )}
    </>
  );
}
