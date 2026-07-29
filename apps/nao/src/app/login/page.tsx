'use client';

// ourobion nao — login page (Client Component).
//
// Minimal Supabase email + password sign-in using the browser client from
// @supabase/ssr. On success the session is persisted in cookies (by the SSR
// client) and we navigate to the originally-requested path (?redirectedFrom)
// or the dashboard root. Styled inline against the dark theme tokens — no
// hardcoded hex, all `var(--token)`.
//
// v1 keeps this deliberately small: one email/password form. (Magic-link/OTP
// can be layered on later; the gate only cares that a valid session exists.)
//
// Brand: this is the one screen with room for the full vertical lockup
// (/brand/nao-lockup-dark.svg — mark stacked over the "ourobion / nao"
// wordmark). It replaces the old plain-text eyebrow.
//
// The lockup sits on the page canvas ABOVE the card, not inside it, and that
// placement is deliberate: the kit's dark variant is keyed to "#0B1D24 or
// darker", and the card surface (--surface, #102832) is LIGHTER than that
// floor. --bg is exactly #0B1D24, so the canvas is the only surface on this
// screen the dark artwork is actually specified for. `logoWrap` then applies
// the DESIGN.md clear-space rule around it.
import { Suspense, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

// `useSearchParams` forces client-side rendering for the subtree that reads it,
// so it must live under a Suspense boundary or `next build` bails out with a
// CSR error. Keep the reader in an inner component; the page shell provides the
// boundary.
export default function LoginPage() {
  return (
    <Suspense fallback={<main style={styles.main} />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get('redirectedFrom') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const supabase = createBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(signInError.message);
        setPending(false);
        return;
      }
      // Session cookies are set; let the server re-evaluate the gate.
      router.replace(redirectedFrom);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      setPending(false);
    }
  }

  return (
    <main style={styles.main}>
      <div style={styles.logoWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/nao-lockup-dark.svg" alt="ourobion nao" style={styles.logo} />
      </div>
      <section style={styles.card}>
        <h1 style={styles.heading}>Sign in</h1>
        <p style={styles.subtitle}>
          A window into the brain. Access is limited to authorized accounts.
        </p>

        <form onSubmit={handleSubmit} style={styles.form} noValidate>
          <label style={styles.label}>
            <span style={styles.labelText}>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="you@example.com"
            />
          </label>

          <label style={styles.label}>
            <span style={styles.labelText}>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
            />
          </label>

          {error ? (
            <p role="alert" style={styles.error}>
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={pending} style={styles.button}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  main: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    background: 'var(--bg)',
  },
  card: {
    width: '100%',
    maxWidth: '24rem',
    padding: '2rem',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--border-glow)',
  },
  logoWrap: {
    display: 'flex',
    justifyContent: 'center',
    // Clear space of at least the envelope-ring diameter around the mark
    // (DESIGN.md). At this render size the envelope ring is ~45% of the
    // lockup width, so 2.5rem all round clears it comfortably.
    padding: '0 2.5rem 2.5rem',
  },
  logo: {
    width: '100%',
    // 240px. The earlier 180px kept the mark legible but shrank the
    // `ourobion` kicker below readability — it is a small tracked line in
    // the supplied artwork, so the lockup has to be sized for the WORDMARK,
    // not just for the 40px mark floor.
    maxWidth: '15rem',
    height: 'auto',
    display: 'block',
  },
  heading: {
    margin: '0.5rem 0 0.25rem',
    fontSize: '1.75rem',
    color: 'var(--text-primary)',
  },
  subtitle: {
    margin: '0 0 1.5rem',
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    lineHeight: 1.5,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  labelText: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  input: {
    width: '100%',
    padding: '0.65rem 0.8rem',
    background: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    font: 'inherit',
    fontSize: '0.95rem',
    outline: 'none',
  },
  error: {
    margin: 0,
    color: 'var(--state-mid)',
    fontSize: '0.85rem',
  },
  button: {
    marginTop: '0.5rem',
    padding: '0.7rem 1rem',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--accent-gradient)',
    color: 'var(--bg)',
    font: 'inherit',
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: 'pointer',
  },
};
