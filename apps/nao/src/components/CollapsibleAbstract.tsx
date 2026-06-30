'use client';

// ourobion nao — collapsible abstract panel (Client Component).
// The abstract is metadata (safe to show); full paper text is never served.
import { useState } from 'react';
import type { KeyboardEvent } from 'react';

export function CollapsibleAbstract({ text }: { text: string }) {
  const [open, setOpen] = useState(true);

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((o) => !o);
    }
  }

  return (
    <div className="detail__section">
      <div
        className="detail__abstract-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
      >
        <div className="eyebrow">Abstract</div>
        <span className="detail__abstract-toggle">{open ? 'Hide' : 'Show'}</span>
      </div>
      {open ? <p className="detail__abstract">{text}</p> : null}
    </div>
  );
}
