// ourobion nao — EyebrowLabel.
//
// The biotope-inherited uppercase, letter-spaced eyebrow label (NAO-DESIGN §7).
// Server component (no interactivity). Renders via the global `.eyebrow` class
// (defined in globals.css) so the token + spacing stay in one place.
import type { CSSProperties, ReactNode } from 'react';

export function EyebrowLabel({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <p className="eyebrow" style={{ margin: 0, ...style }}>
      {children}
    </p>
  );
}
