// ourobion nao — "How Ourobion works" (public explainer).
//
// Reused by the canonical public root. It is a plain static Server Component:
// no client directive, data fetching, or privileged D1/R2/Supabase/auth/audit
// import. The route and middleware boundaries are proven in
// apps/nao/tests/howItWorks.test.ts.
//
// Copy is fixed verbatim by design (issue #260): no metrics, no third-party
// names, no internal-link detail. Keep edits to wording out of this file —
// update the issue/design doc first, then mirror the approved strings here
// and in the test.
import type { CSSProperties } from 'react';
import Link from 'next/link';

const CARDS: ReadonlyArray<{ label: string; body: string }> = [
  {
    label: 'BIOTOPE',
    body: 'A personal app for recording daily observations and revisiting patterns over time.',
  },
  {
    label: 'NAO',
    body: 'A workspace for authorized team members to inspect and prepare research context.',
  },
  {
    label: 'THE BOUNDARY',
    body:
      "Biotope and nao do not call each other directly. Personal entries stay in Biotope's account-bound experience; nao is not a personal-records dashboard.",
  },
];

const STAGES: readonly string[] = ['SYNTHESIS', 'INDEPENDENT VERIFICATION', 'PUBLICATION'];

export function OurobionExplainer() {
  return (
    <main style={styles.main}>
      <div style={styles.wrap}>
        <p className="eyebrow">OUROBION</p>
        <h1 style={styles.heading}>How Ourobion works</h1>
        <p style={styles.intro}>
          Ourobion connects a personal reflection app with an expert workspace for preparing
          research context.
        </p>

        <section style={styles.cards} aria-label="The two apps and the boundary between them">
          {CARDS.map((card) => (
            <article key={card.label} style={styles.card}>
              <p className="eyebrow" style={styles.cardLabel}>
                {card.label}
              </p>
              <p style={styles.cardBody}>{card.body}</p>
            </article>
          ))}
        </section>

        <section style={styles.flowSection} aria-label="The high-level stages">
          <ol style={styles.flow}>
            {STAGES.map((stage, i) => (
              <li key={stage} style={styles.flowItem}>
                <span style={styles.flowStage}>{stage}</span>
                {i < STAGES.length - 1 ? <span style={styles.flowSep}>→</span> : null}
              </li>
            ))}
          </ol>
        </section>

        <p style={styles.unlock}>
          Signing in gives authorized workspace members access to the review tools for research
          context.
        </p>

        <div style={styles.ctaBlock}>
          <Link href="/login" style={styles.cta}>
            Sign in to nao
          </Link>
          <p style={styles.ctaNote}>For authorized workspace members.</p>
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  main: {
    minHeight: '100vh',
    background: 'var(--bg)',
    padding: '3rem 1.25rem',
  },
  wrap: {
    width: '100%',
    maxWidth: '48rem',
    margin: '0 auto',
  },
  heading: {
    margin: '0.75rem 0 1rem',
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
    color: 'var(--text-bright)',
  },
  intro: {
    margin: '0 0 2rem',
    color: 'var(--text-secondary)',
    fontSize: '1rem',
    lineHeight: 1.6,
    maxWidth: '38rem',
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))',
    gap: '1rem',
    marginBottom: '2.5rem',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '1.25rem',
  },
  cardLabel: {
    margin: '0 0 0.6rem',
  },
  cardBody: {
    margin: 0,
    color: 'var(--text-primary)',
    fontSize: '0.92rem',
    lineHeight: 1.55,
  },
  flowSection: {
    marginBottom: '2.5rem',
  },
  flow: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.6rem',
  },
  flowItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  flowStage: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.78rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    color: 'var(--text-bright)',
    background: 'var(--panel-inset)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-pill)',
    padding: '0.45rem 0.9rem',
    whiteSpace: 'nowrap',
  },
  flowSep: {
    color: 'var(--text-muted)',
  },
  unlock: {
    margin: '0 0 1.5rem',
    color: 'var(--text-secondary)',
    fontSize: '0.95rem',
    lineHeight: 1.6,
    maxWidth: '38rem',
  },
  ctaBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.5rem',
  },
  cta: {
    display: 'inline-block',
    padding: '0.7rem 1.25rem',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--accent-gradient)',
    color: 'var(--bg)',
    fontWeight: 700,
    fontSize: '0.95rem',
    textDecoration: 'none',
  },
  ctaNote: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
  },
};
